import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { Resend } from 'resend';

// Increase Vercel timeout — requires Pro plan for full 60s
export const maxDuration = 60;

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres SQC Scope, un agente especializado en control de calidad (QC) para instalaciones solares bajo el programa Palmetto LightReach. Tu función es evaluar fotografías de instalaciones solares y generar reportes de QC detallados para determinar si un proyecto está listo para ser sometido al hito M1.

REGLAS FUNDAMENTALES:
1. Nunca rechaces lo que no puedes ver claramente — solicita foto adicional en su lugar
2. Evalúa sets completos de fotos, no imágenes individuales
3. Imperfecciones estéticas menores NO son criterio de rechazo — enfócate en cumplimiento funcional y de seguridad
4. Sé específico al solicitar fotos adicionales (ángulo, qué debe ser visible, por qué)
5. Asume buena fe — el instalador está intentando cumplir
6. Criterios dependientes del diseño requieren confirmación del plano

SISTEMA DE EVALUACIÓN:
✅ PASS — Criterio cumplido y claramente visible
⚠️ NECESITA FOTO — No se puede evaluar, requiere ángulo diferente o foto adicional
❌ FALLA — Incumplimiento claro visible
➖ N/A — No aplica a esta instalación

NIVELES DE HALLAZGO:
- FALLA BLOQUEANTE: Cosas que Palmetto rechaza definitivamente (cobre expuesto, double taps, sealant faltante en bota)
- VERIFICAR: Ambiguo, requiere confirmación del QC supervisor
- OBSERVACIÓN: Debe corregirse por buenas prácticas pero Palmetto no ha rechazado (ej: film protector no removido)

CATEGORÍAS DE EVALUACIÓN EXTERIORES:
1. Anclaje / botas (sealant — requiere foto TOP-VIEW)
2. Clamps (end clamps y mid clamps)
3. Módulos solares
4. Conduit y wiring exterior
5. Labels exteriores

CATEGORÍAS DE EVALUACIÓN INTERIORES:
6. Panel principal / contador
7. RSS (Rapid Shutdown Switch)
8. Junction boxes
9. Gateway / Sistema de control
10. Baterías (Powerwall / IQ Battery / Franklin)
11. Sistema Enphase específico (IQ Combiner 5C, IQ System Controller 3)

NOTAS DE CAMPO APRENDIDAS:
- Film protector: Palmetto NO ha rechazado por esto — clasificar como OBSERVACIÓN
- Labels manuscritos en breakers: clasificar como VERIFICAR
- Wire nuts: solo FALLA si hay cobre expuesto más allá del wire nut

FORMATO DE REPORTE DE SALIDA:
═══════════════════════════════════════
REPORTE QC — SQC SCOPE
═══════════════════════════════════════
PROYECTO: [Nombre]
DIRECCIÓN: [Dirección]
SISTEMA: [Sistema]
FECHA EVALUACIÓN: [Fecha actual]
═══════════════════════════════════════
VEREDICTO GENERAL: [LISTO PARA M1 / NO LISTO — CORRECCIONES REQUERIDAS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HALLAZGOS POR CATEGORÍA:
[Para cada categoría: ícono, nombre, estado, hallazgo, acción si aplica]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMEN DE ACCIONES:
FALLAS BLOQUEANTES: [número y lista]
FOTOS ADICIONALES REQUERIDAS: [número y lista]
OBSERVACIONES: [número y lista]
═══════════════════════════════════════
Generado por SQC Scope — Sistema de QC Solar
═══════════════════════════════════════`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compress image buffer to stay under 5MB (rough resize via base64 trim approach) */
function shouldCompressImage(buffer: Buffer): boolean {
  return buffer.length > 4 * 1024 * 1024; // > 4MB
}

/** Convert File to base64 string and media type */
async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Map media types to Claude-supported ones
  let mediaType = file.type || 'image/jpeg';
  if (mediaType === 'image/heic' || mediaType === 'image/heif') {
    // Claude doesn't support HEIC natively — treat as jpeg
    mediaType = 'image/jpeg';
  }
  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
    mediaType = 'image/jpeg';
  }

  return {
    data: buffer.toString('base64'),
    mediaType,
  };
}

/** Upload files to Google Drive folder */
async function uploadToGoogleDrive(
  projectName: string,
  date: string,
  photos: File[],
  planFile: File | null
): Promise<string | null> {
  try {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!credentialsJson || !rootFolderId) {
      console.warn('Google Drive credentials not configured');
      return null;
    }

    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Create project folder
    const folderName = `${projectName} — ${date}`;
    const folderResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
      fields: 'id, webViewLink',
    });

    const folderId = folderResponse.data.id!;
    const folderLink = folderResponse.data.webViewLink!;

    // Upload photos
    const uploadPromises = photos.map(async (photo, idx) => {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const { Readable } = await import('stream');
      const stream = Readable.from(buffer);

      return drive.files.create({
        requestBody: {
          name: photo.name || `foto_${idx + 1}.jpg`,
          parents: [folderId],
        },
        media: {
          mimeType: photo.type || 'image/jpeg',
          body: stream,
        },
        fields: 'id',
      });
    });

    // Upload plan if exists
    if (planFile) {
      const planBuffer = Buffer.from(await planFile.arrayBuffer());
      const { Readable } = await import('stream');
      const planStream = Readable.from(planBuffer);
      uploadPromises.push(
        drive.files.create({
          requestBody: {
            name: planFile.name || 'plano.pdf',
            parents: [folderId],
          },
          media: {
            mimeType: 'application/pdf',
            body: planStream,
          },
          fields: 'id',
        })
      );
    }

    await Promise.allSettled(uploadPromises);
    return folderLink;
  } catch (error) {
    console.error('Google Drive upload error:', error);
    return null;
  }
}

/** Send report email via Resend */
async function sendReportEmail(
  recipientEmail: string,
  projectName: string,
  address: string,
  systemType: string,
  report: string
): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('Resend API key not configured');
      return false;
    }

    const resend = new Resend(apiKey);

    // Determine verdict for subject line
    const isReady = report.includes('LISTO PARA M1');
    const verdictEmoji = isReady ? '✅' : '⚠️';
    const verdictText = isReady ? 'LISTO PARA M1' : 'CORRECCIONES REQUERIDAS';

    const htmlReport = report
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const { error } = await resend.emails.send({
      from: 'SQC Scope <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `${verdictEmoji} Reporte QC — ${projectName} — ${verdictText}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte QC — SQC Scope</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #f5f4f0; margin: 0; padding: 20px;">
  <div style="max-width: 640px; margin: 0 auto;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #B7960C 0%, #D4AF37 100%); border-radius: 16px; padding: 24px; margin-bottom: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">⚡ SQC Scope</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 13px;">Solar Quality Control — Palmetto LightReach M1</p>
    </div>

    <!-- Verdict -->
    <div style="background: ${isReady ? '#f0fdf4' : '#fffbeb'}; border: 2px solid ${isReady ? '#86efac' : '#fcd34d'}; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Veredicto General</p>
      <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${isReady ? '#15803d' : '#b45309'};">
        ${verdictEmoji} ${verdictText}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #374151;"><strong>Proyecto:</strong> ${projectName}</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;"><strong>Dirección:</strong> ${address}</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;"><strong>Sistema:</strong> ${systemType}</p>
    </div>

    <!-- Report -->
    <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 20px;">
      <div style="background: #f9fafb; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <span style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Reporte Completo</span>
      </div>
      <div style="padding: 16px; overflow-x: auto;">
        <pre style="font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.7; color: #1f2937; white-space: pre-wrap; word-break: break-word; margin: 0;">${htmlReport}</pre>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px;">
      <p style="font-size: 11px; color: #9ca3af; margin: 0;">
        Generado automáticamente por SQC Scope · Puerto Rico<br>
        Este reporte es confidencial y está destinado únicamente al destinatario.
      </p>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Send email error:', error);
    return false;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();

    const projectName = (formData.get('projectName') as string) || '';
    const address = (formData.get('address') as string) || '';
    const systemType = (formData.get('system') as string) || '';
    const email = (formData.get('email') as string) || '';
    const notes = (formData.get('notes') as string) || '';

    const photoFiles = formData.getAll('photos') as File[];
    const planFile = formData.get('plan') as File | null;

    if (!projectName || !address || !systemType || !email) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    if (photoFiles.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos una foto' }, { status: 400 });
    }

    const today = new Date();
    const dateString = today.toLocaleDateString('es-PR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // ── 1. Google Drive upload (non-blocking, best-effort) ─────────────────
    const driveFolderPromise = uploadToGoogleDrive(
      projectName,
      dateString.replace(/\//g, '-'),
      photoFiles.slice(0, 20),
      planFile
    );

    // ── 2. Prepare images for Claude ──────────────────────────────────────
    const MAX_IMAGES = 20;
    const imagesToProcess = photoFiles.slice(0, MAX_IMAGES);

    // Convert all images to base64 in parallel
    const imageDataArray = await Promise.all(
      imagesToProcess.map(file => fileToBase64(file))
    );

    // Build Claude content array
    const imageContent: Anthropic.ImageBlockParam[] = imageDataArray.map(({ data, mediaType }) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data,
      },
    }));

    const textContent: Anthropic.TextBlockParam = {
      type: 'text',
      text: `Por favor evalúa estas fotos de la instalación solar y genera el reporte QC completo.

DATOS DEL PROYECTO:
- Nombre/Cliente: ${projectName}
- Dirección: ${address}
- Sistema instalado: ${systemType}
- Fecha de evaluación: ${dateString}
- Total de fotos enviadas: ${imagesToProcess.length}${photoFiles.length > MAX_IMAGES ? ` (de ${photoFiles.length} subidas, se procesaron las primeras ${MAX_IMAGES})` : ''}
${planFile ? `- Plano del proyecto: Adjunto (${planFile.name})` : '- Plano del proyecto: No proporcionado'}
${notes ? `- Notas del instalador: ${notes}` : ''}

Genera el reporte QC completo siguiendo estrictamente el formato establecido en tus instrucciones.`,
    };

    // ── 3. Call Claude API ─────────────────────────────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Configuración de IA no disponible' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: anthropicKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [...imageContent, textContent],
        },
      ],
    });

    const report =
      message.content[0]?.type === 'text' ? message.content[0].text : 'Error al generar el reporte';

    // ── 4. Send email (non-blocking) ───────────────────────────────────────
    const emailPromise = sendReportEmail(email, projectName, address, systemType, report);

    // Wait for drive and email in parallel
    const [driveFolder, emailSent] = await Promise.all([
      driveFolderPromise,
      emailPromise,
    ]);

    return NextResponse.json({
      success: true,
      report,
      driveFolder,
      emailSent,
    });
  } catch (error) {
    console.error('Analysis error:', error);

    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        return NextResponse.json(
          { error: 'Límite de uso de IA alcanzado. Intenta en unos minutos.' },
          { status: 429 }
        );
      }
      if (error.message.includes('timeout') || error.message.includes('FUNCTION_INVOCATION_TIMEOUT')) {
        return NextResponse.json(
          { error: 'El análisis tardó demasiado. Intenta con menos fotos o en un momento de menor tráfico.' },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error interno del servidor. Por favor intenta de nuevo.' },
      { status: 500 }
    );
  }
}

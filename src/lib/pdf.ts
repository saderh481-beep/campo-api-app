import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Bitacora } from "@/models";

export async function generarPdfBitacora(bitacora: Bitacora): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = height - margin;

  page.drawText("SECRETARÍA DE AGRICULTURA Y DESARROLLO RURAL · HIDALGO", {
    x: margin, y, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
  });
  y -= 22;
  page.drawText("BITÁCORA DE CAMPO", {
    x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.3, 0.6),
  });
  y -= 28;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.1, 0.3, 0.6) });
  y -= 20;

  const campos: [string, unknown][] = [
    ["ID", bitacora.id],
    ["Tipo", bitacora.tipo],
    ["Estado", bitacora.estado],
    ["Técnico ID", bitacora.tecnico_id],
    ["Beneficiario ID", bitacora.beneficiario_id ?? "—"],
    ["Cadena Productiva ID", bitacora.cadena_productiva_id ?? "—"],
    ["Actividad ID", bitacora.actividad_id ?? "—"],
    ["Fecha inicio", bitacora.fecha_inicio],
    ["Fecha fin", bitacora.fecha_fin ?? "—"],
    ["Coordenadas inicio", bitacora.coord_inicio ?? "—"],
    ["Coordenadas fin", bitacora.coord_fin ?? "—"],
    ["Actividades realizadas", bitacora.actividades_desc ?? "—"],
    ["Recomendaciones", bitacora.recomendaciones ?? "—"],
    ["Comentarios del beneficiario", bitacora.comentarios_beneficiario ?? "—"],
    ["Coordinación interinstitucional", bitacora.coordinacion_interinst ? "Sí" : "No"],
    ["Instancia coordinada", bitacora.instancia_coordinada ?? "—"],
    ["Propósito de coordinación", bitacora.proposito_coordinacion ?? "—"],
    ["Observaciones del coordinador", bitacora.observaciones_coordinador ?? "—"],
    ["Calificación", bitacora.calificacion?.toString() ?? "—"],
    ["Reporte", bitacora.reporte ?? "—"],
    ["Creada offline", bitacora.creada_offline ? "Sí" : "No"],
    ["Sync ID", bitacora.sync_id ?? "—"],
  ];

  for (const [label, value] of campos) {
    if (y < margin + 60) {
      page = pdfDoc.addPage([595, 842]);
      y = height - margin;
    }
    page.drawText(`${label}:`, { x: margin, y, size: 9, font: fontBold });
    const textValue = String(value ?? "");
    page.drawText(textValue, { x: margin + 180, y, size: 9, font: fontRegular });
    y -= 16;
  }

  y -= 10;
  if (y < margin + 100) {
    page = pdfDoc.addPage([595, 842]);
    y = height - margin;
  }

  if (bitacora.foto_rostro_url) {
    try {
      page.drawText("Foto de rostro:", { x: margin, y, size: 10, font: fontBold });
      y -= 10;
      const res = await fetch(String(bitacora.foto_rostro_url));
      const imgBytes = await res.arrayBuffer();
      const img = await pdfDoc.embedJpg(imgBytes).catch(() => pdfDoc.embedPng(imgBytes));
      const imgHeight = Math.min(100, (img.width / img.height) * 100);
      page.drawImage(img, { x: margin, y: y - imgHeight, width: 100, height: imgHeight });
      y -= Math.max(110, imgHeight + 20);
    } catch { /* foto no disponible */ }
  }

  if (y < margin + 80) {
    page = pdfDoc.addPage([595, 842]);
    y = height - margin;
  }

  if (bitacora.firma_url) {
    page.drawText("Firma del beneficiario:", { x: margin, y, size: 10, font: fontBold });
    y -= 10;
    try {
      const res = await fetch(String(bitacora.firma_url));
      const imgBytes = await res.arrayBuffer();
      const img = await pdfDoc.embedPng(imgBytes).catch(() => pdfDoc.embedJpg(imgBytes));
      const imgHeight = Math.min(60, (img.width / img.height) * 150);
      page.drawImage(img, { x: margin, y: y - imgHeight, width: 150, height: imgHeight });
      y -= Math.max(70, imgHeight + 20);
    } catch { /* firma no disponible */ }
  }

  if (bitacora.fotos_campo && bitacora.fotos_campo.length > 0) {
    if (y < margin + 100) {
      page = pdfDoc.addPage([595, 842]);
      y = height - margin;
    }
    page.drawText("Fotos de campo:", { x: margin, y, size: 10, font: fontBold });
    y -= 15;

    const imgWidth = 85;
    const imgHeight = 70;
    const cols = 3;
    let col = 0;

    for (const fotoUrl of bitacora.fotos_campo) {
      if (y < margin + imgHeight + 20) {
        page = pdfDoc.addPage([595, 842]);
        y = height - margin;
      }
      try {
        const res = await fetch(String(fotoUrl));
        const imgBytes = await res.arrayBuffer();
        const img = await pdfDoc.embedJpg(imgBytes).catch(() => pdfDoc.embedPng(imgBytes));
        const scaledHeight = (img.width / img.height) * imgWidth;
        const xPos = margin + col * (imgWidth + 15);
        page.drawImage(img, { x: xPos, y: y - scaledHeight, width: imgWidth, height: scaledHeight });
      } catch { /* foto no disponible */ }
      col++;
      if (col >= cols) {
        col = 0;
        y -= imgHeight + 15;
      }
    }
  }

  return pdfDoc.save();
}

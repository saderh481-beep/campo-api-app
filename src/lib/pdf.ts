import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

type Bitacora = Record<string, unknown>;

export async function generarPdfBitacora(bitacora: Bitacora): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
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
    ["Fecha inicio", bitacora.fecha_inicio],
    ["Fecha fin", bitacora.fecha_fin ?? "—"],
    ["Observaciones", bitacora.observaciones_coordinador ?? "—"],
    ["Actividades realizadas", bitacora.actividades_desc ?? "—"],
    ["Coordenadas inicio", bitacora.coord_inicio ?? "—"],
    ["Coordenadas fin", bitacora.coord_fin ?? "—"],
  ];

  for (const [label, value] of campos) {
    if (y < margin + 60) break;
    page.drawText(`${label}:`, { x: margin, y, size: 10, font: fontBold });
    page.drawText(String(value ?? ""), { x: margin + 170, y, size: 10, font: fontRegular });
    y -= 18;
  }

  if (bitacora.foto_rostro_url) {
    try {
      const res = await fetch(String(bitacora.foto_rostro_url));
      const imgBytes = await res.arrayBuffer();
      const img = await pdfDoc.embedJpg(imgBytes).catch(() => pdfDoc.embedPng(imgBytes));
      page.drawImage(img, { x: width - margin - 100, y: height - margin - 120, width: 90, height: 90 });
    } catch { /* foto no disponible */ }
  }

  if (bitacora.firma_url) {
    try {
      const res = await fetch(String(bitacora.firma_url));
      const imgBytes = await res.arrayBuffer();
      const img = await pdfDoc.embedPng(imgBytes).catch(() => pdfDoc.embedJpg(imgBytes));
      page.drawText("Firma del beneficiario:", { x: margin, y, size: 9, font: fontBold });
      y -= 70;
      page.drawImage(img, { x: margin, y, width: 150, height: 60 });
      y -= 20;
    } catch { /* firma no disponible */ }
  }

  return pdfDoc.save();
}

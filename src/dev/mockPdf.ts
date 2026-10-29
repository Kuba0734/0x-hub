/** A small multi-page PDF for the browser mock (pdf.js repairs the approximate xref). */
export function mockPdf(pages = 3): ArrayBuffer {
  const objects: string[] = [];
  const kids: string[] = [];
  // 1: catalog, 2: pages, 3: font, then two objects (page + content) per page.
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (let i = 0; i < pages; i++) {
    const page = 4 + i * 2;
    const text = [
      "BT /F1 28 Tf 72 740 Td (Rental agreement) Tj ET",
      `BT /F1 14 Tf 72 700 Td (Page ${i + 1} of ${pages}) Tj ET`,
      "BT /F1 12 Tf 72 660 Td (ID number: X1234567  Tenant: Alex Example) Tj ET",
      "0.85 g 72 120 220 1 re f",
      "BT /F1 10 Tf 72 105 Td (Signature) Tj ET",
    ].join("\n");
    objects[page] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`;
    objects[page + 1] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
    kids.push(`${page} 0 R`);
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`;

  let out = "%PDF-1.7\n";
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objects.length; n++)
    out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out).buffer;
}

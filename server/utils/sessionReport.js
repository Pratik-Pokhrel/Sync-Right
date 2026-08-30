// this file allows to generate a downloadable PDF session report

import PDFDocument from "pdfkit";

export const streamSessionReportPDF = (res, session, room) => {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename='session-report-${session._id}.pdf'`,
  );

  doc.pipe(res);

  doc.fontSize(20).text(`Session Report - ${room.name}`, { underline: true });
  doc.moveDown();

  doc.fontSize(12).text(`Started: ${session.startTime.toLocaleString()}`);
  doc.text(
    `Ended: ${session.endTime ? session.endTime.toLocaleString() : "Ongoing"}`,
  );
  doc.text(
    `Duration: ${session.duration ? `${Math.round(session.duration / 60)} min` : "N/A"}`,
  );
  doc.text(`Participants: ${session.participants.length}`);
  doc.moveDown();

  doc.fontSize(14).text("Summary", { underline: true });
  doc.fontSize(12).text(session.summary || "No Summary Available yet");
  doc.moveDown();

  doc.fontSize(14).text("Action Items", { underline: true });
  if (session.actionItems?.length) {
    session.actionItems.forEach((item) => doc.fontSize(12).text(`- ${item}`));
  } else {
    doc.fontSize(12).text("No action items identified.");
  }

  doc.end();
};

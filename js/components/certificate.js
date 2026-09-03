/**
 * Certificate Generator Component
 * Renders an official certificate of achievement onto an HTML5 Canvas,
 * enabling immediate high-resolution PNG download and print support.
 */
class CertificateGenerator {
  static generate({ studentName, quizTitle, score, totalMarks, percentage, date, certificateId }) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 800);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(0.5, "#1e1b4b");
    bgGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 800);

    // Elegant Outer Border
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, 1140, 740);

    // Inner Gold Accent Border
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 45, 1110, 710);

    // Corner decorative accents
    this.drawCorner(ctx, 55, 55);
    this.drawCorner(ctx, 1145, 55, true);
    this.drawCorner(ctx, 55, 745, false, true);
    this.drawCorner(ctx, 1145, 745, true, true);

    // Header Badge / Logo
    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 20px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "6px";
    ctx.fillText("QUIZZMASTER ACADEMY", 600, 120);

    // Main Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Outfit', sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("CERTIFICATE OF ACHIEVEMENT", 600, 190);

    // Subtitle
    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px 'Plus Jakarta Sans', sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText("THIS IS PROUDLY PRESENTED TO", 600, 245);

    // Student Name
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 46px 'Outfit', sans-serif";
    ctx.fillText(studentName || "Distinguished Scholar", 600, 320);

    // Underline for student name
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(350, 340);
    ctx.lineTo(850, 340);
    ctx.stroke();

    // Body Description
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "20px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("for successfully completing the online assessment and demonstrating proficiency in", 600, 395);

    // Quiz Title
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.fillText(`"${quizTitle}"`, 600, 455);

    // Performance Metrics
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "22px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(`Final Score: ${score}/${totalMarks}  •  Grade: ${percentage}% (PASSED)`, 600, 510);

    // Footer - Left: Date & Cert ID
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "15px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(`Issue Date: ${new Date(date).toLocaleDateString()}`, 100, 660);
    ctx.fillText(`Certificate ID: ${certificateId || "CERT-" + Math.random().toString(36).substr(2, 8).toUpperCase()}`, 100, 685);

    // Footer - Center: Seal
    ctx.save();
    ctx.translate(600, 640);
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.fillStyle = "#4338ca";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("★", 0, -8);
    ctx.font = "bold 11px 'Outfit', sans-serif";
    ctx.fillText("VERIFIED", 0, 14);
    ctx.fillText("EXCELLENCE", 0, 26);
    ctx.restore();

    // Footer - Right: Instructor Signature
    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "italic 24px 'Brush Script MT', cursive, sans-serif";
    ctx.fillText("Dr. Sarah Mitchell", 1100, 650);

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(900, 665);
    ctx.lineTo(1100, 665);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Head Assessment Director", 1100, 688);

    return canvas;
  }

  static drawCorner(ctx, x, y, flipX = false, flipY = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(0, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    ctx.restore();
  }

  static download(canvas, filename = "quiz-certificate.png") {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}

window.CertificateGenerator = CertificateGenerator;

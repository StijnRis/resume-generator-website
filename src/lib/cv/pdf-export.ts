import {
  CV_PAGE_HEIGHT_MM,
  CV_PAGE_PADDING_MM,
  CV_PAGE_WIDTH_MM,
} from "@/lib/cv/page-geometry";

export async function downloadCvPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".cv-page").forEach((page) => {
    if (page instanceof HTMLElement) {
      page.style.boxShadow = "none";
      page.style.marginBottom = "0";
    }
  });

  const styles = `
    @page { size: A4 portrait; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .cv-document {
      width: ${CV_PAGE_WIDTH_MM}mm;
      margin: 0 auto;
    }
    .cv-page {
      width: ${CV_PAGE_WIDTH_MM}mm;
      height: ${CV_PAGE_HEIGHT_MM}mm;
      max-height: ${CV_PAGE_HEIGHT_MM}mm;
      padding: ${CV_PAGE_PADDING_MM}mm;
      box-sizing: border-box;
      margin: 0 !important;
      box-shadow: none !important;
      background: #ffffff;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .cv-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    @media print {
      .cv-page {
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Could not create print frame");
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${filename}</title>
    <style>${styles}</style>
  </head>
  <body>${clone.outerHTML}</body>
</html>`);
  doc.close();

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    win.onafterprint = () => {
      cleanup();
      resolve();
    };

    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (error) {
        cleanup();
        reject(error);
      }
    }, 250);
  });
}

import path from "node:path";
import fs from "node:fs";
import fsP from "node:fs/promises";

const htmlTemplate = (diff: string): string => `<html>
<head>
  <title>GraphQL Schema Diff</title>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="css/hljs.min.css">
  <link rel="stylesheet" href="css/diff2html.min.css">
  <script src="js/highlight.min.js"></script>
  <script src="js/graphql.min.js"></script>
  <script src="js/diff2html.min.js"></script>
  <script src="js/diff2html-ui-base.min.js "></script>
</head>
<body>
  <div id="diff"></div>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const diffString = \`${diff}\`;
      const targetElement = document.getElementById('diff');
      const configuration = {
        matching: 'lines',
        outputFormat: 'side-by-side',
        highlight: true,
        synchronisedScroll: false,
        drawFileList: false,
        rawTemplates: {
          'tag-file-renamed': '',
        }
      };
      const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration, hljs);
      diff2htmlUi.draw();
    });
  </script>
</body>
</html>`;

export interface Options {
  outputDirectory?: string;
}

export async function createHtmlOutput(
  diff: string,
  options: Options = {}
): Promise<void> {
  const { outputDirectory = "schemaDiff" } = options;

  const adjustedDiff = diff
    .replace(/(---\s.*)\sremoved/, "$1")
    .replace(/(\+\+\+\s.*)\sadded/, "$1")
    .replace("No newline at end of file", "");

  if (!fs.existsSync(path.join(outputDirectory, "js"))) {
    fs.mkdirSync(path.join(outputDirectory, "js"), { recursive: true });
  }

  if (!fs.existsSync(path.join(outputDirectory, "css"))) {
    fs.mkdirSync(path.join(outputDirectory, "css"), { recursive: true });
  }

  const diff2HtmlPath = new URL(
    ".",
    import.meta.resolve("diff2html/package.json")
  ).pathname;
  const highlightJsPath = new URL(
    ".",
    import.meta.resolve("@highlightjs/cdn-assets/package.json")
  ).pathname;

  await Promise.all([
    fsP.copyFile(
      path.join(diff2HtmlPath, "bundles/js/diff2html.min.js"),
      path.join(outputDirectory, "js/diff2html.min.js")
    ),
    fsP.copyFile(
      path.join(diff2HtmlPath, "bundles/css/diff2html.min.css"),
      path.join(outputDirectory, "css/diff2html.min.css")
    ),
    fsP.copyFile(
      path.join(highlightJsPath, "styles/default.min.css"),
      path.join(outputDirectory, "css/hljs.min.css")
    ),
    fsP.copyFile(
      path.join(highlightJsPath, "highlight.min.js"),
      path.join(outputDirectory, "js/highlight.min.js")
    ),
    fsP.copyFile(
      path.join(highlightJsPath, "languages/graphql.min.js"),
      path.join(outputDirectory, "js/graphql.min.js")
    ),
  ]);

  const diff2htmlUiBase = (
    await fsP.readFile(
      path.join(diff2HtmlPath, "bundles/js/diff2html-ui-base.min.js")
    )
  )
    .toString()
    // Hacky way to force GraphQL syntax highlighting
    .replace('void 0!==t?t:"plaintext"', '"graphql"');

  const htmlOutput = htmlTemplate(adjustedDiff);
  await Promise.all([
    fsP.writeFile(path.join(outputDirectory, "index.html"), htmlOutput),
    fsP.writeFile(
      path.join(outputDirectory, "js/diff2html-ui-base.min.js"),
      diff2htmlUiBase
    ),
  ]);
}

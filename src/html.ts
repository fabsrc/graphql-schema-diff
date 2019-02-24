import path from 'path';
import fs from 'fs-extra';
import { Diff2Html } from 'diff2html';

const htmlTemplate = (diffHtml: string): string => `<html>
<head>
  <title>GraphQL Schema Diff</title>
  <meta charset="utf-8" /> 
  <link rel="stylesheet" href="diff2html.css">
  <script src="diff2html.js"></script>
  <script src="diff2html-ui.js"></script>
  <style>
    html { box-sizing: border-box; }
    *,*:before,*:after { box-sizing: inherit; }
  </style>
</head>
<body>
  ${diffHtml}
</body>
</html>`;

export interface Options {
  outputDirectory?: string;
}

export async function createHtmlOutput(
  diff: string,
  options: Options = {}
): Promise<void> {
  const { outputDirectory = 'schemaDiff' } = options;

  const adjustedDiff = diff
    .replace(/(---\s.*)\sremoved/, '$1')
    .replace(/(\+\+\+\s.*)\sadded/, '$1');
  const diffHtml = Diff2Html.getPrettyHtml(adjustedDiff, {
    inputFormat: 'diff',
    matching: 'lines',
    outputFormat: 'side-by-side',
    rawTemplates: {
      'tag-file-renamed': ''
    }
  });
  await fs.ensureDir(outputDirectory);
  const diff2HtmlPath = path.dirname(require.resolve('diff2html/package.json'));
  await fs.copy(path.join(diff2HtmlPath, 'dist'), outputDirectory);
  const htmlOutput = htmlTemplate(diffHtml);
  await fs.writeFile(path.join(outputDirectory, 'index.html'), htmlOutput);
}

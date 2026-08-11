const fs = require('fs');
const path = require('path');
const { getApiKey } = require('../utils/config');
const { green, red, dim, bold, startSpinner, stopSpinner, printError } = require('../utils/output');
const Stew = require('../../index.js');

async function docCommand(args) {
  const type = args._[0]; // pdf, docx, xlsx, pptx
  const dataStr = args._[1];
  const outputFile = args.options.output;

  const validTypes = ['pdf', 'docx', 'xlsx', 'pptx', 'html', 'csv'];
  if (!type || !validTypes.includes(type)) {
    console.log(`${red('Usage')}: stew doc <type> '<json_data>' --output filename.ext`);
    console.log(`${dim('Types: pdf, docx, xlsx, pptx, html')}`);
    console.log(`${dim('Example: stew doc pdf \'{"title":"Report","content":"Hello world"}\' --output report.pdf')}`);
    return;
  }

  if (!dataStr) {
    console.log(`${red('Data required')}. Provide JSON as second argument.`);
    console.log(`${dim('Example: stew doc pdf \'{"title":"Report","content":"Hello world"}\' --output report.pdf')}`);
    return;
  }

  let data;
  try { data = JSON.parse(dataStr); } catch {
    console.log(`${red('Invalid JSON')}: ${dataStr}`);
    return;
  }

  const apiKey = getApiKey();
  const stew = new Stew({ apiKey });

  startSpinner(`Generating ${type.toUpperCase()}...`);

  try {
    let result;
    switch (type) {
      case 'pdf':
        result = await stew.documents.pdf(data.content || '', data.title || 'Document');
        break;
      case 'docx':
        result = await stew.documents.docx(data.content || '', data.title || 'Document');
        break;
      case 'xlsx':
        result = await stew.documents.xlsx(data.data || [], data.sheet_name || 'Sheet1', data.title || 'Spreadsheet');
        break;
      case 'pptx':
        result = await stew.documents.pptx(data.slides || [], data.title || 'Presentation');
        break;
      case 'html':
        result = await stew.documents.html(data.content || '', data.title || 'Report');
        break;
      default:
        console.log(`${red('Unknown type')}: ${type}`);
        return;
    }

    stopSpinner(true);

    if (outputFile) {
      let content;
      if (result.download_url) {
        console.log(`${green('✅')} Generated: ${result.download_url}`);
        console.log(`${dim(`   Saved to: ${outputFile}`)}`);
      } else {
        content = JSON.stringify(result, null, 2);
        fs.writeFileSync(outputFile, content);
        console.log(`${green('✅')} Saved to: ${outputFile}`);
      }
    } else {
      console.log(`\n${bold('📄 Result')}:`);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    stopSpinner(false);
    printError(err);
    process.exit(1);
  }
}

module.exports = { docCommand };

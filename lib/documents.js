class Documents {
  constructor(client) {
    this.client = client;
  }

  async pdf(content, title = 'Document') {
    return this.client.post('/generate/pdf', {
      content, title, api_key: this.client.apiKey || '',
    });
  }

  async docx(content, title = 'Document') {
    return this.client.post('/generate/docx', {
      content, title, api_key: this.client.apiKey || '',
    });
  }

  async xlsx(data, sheetName = 'Sheet1', title = 'Spreadsheet') {
    return this.client.post('/generate/xlsx', {
      data, sheet_name: sheetName, title, api_key: this.client.apiKey || '',
    });
  }

  async pptx(slides, title = 'Presentation') {
    return this.client.post('/generate/pptx', {
      slides, title, api_key: this.client.apiKey || '',
    });
  }

  async html(content, title = 'Report') {
    return this.client.post('/generate/html', {
      content, title, api_key: this.client.apiKey || '',
    });
  }
}

module.exports = { Documents };

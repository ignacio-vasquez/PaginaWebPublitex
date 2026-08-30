const { JSDOM } = require('jsdom');
const { loadHomepage } = require('./html');

function createDom(html = '<!doctype html><html><body></body></html>') {
  return new JSDOM(html, { url: 'http://localhost/' });
}

function loadHomepageDom() {
  return createDom(loadHomepage());
}

module.exports = { createDom, loadHomepageDom };

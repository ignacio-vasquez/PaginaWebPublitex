function invoiceFile(folio = '23', date = '2024-10-26') {
  return { originalname: 'factura.xml', buffer: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0"><Documento ID="F${folio}"><Encabezado>
<IdDoc><TipoDTE>33</TipoDTE><Folio>${folio}</Folio><FchEmis>${date}</FchEmis></IdDoc>
<Emisor><RUTEmisor>76000000-0</RUTEmisor><RznSoc>Publitex</RznSoc></Emisor>
<Receptor><RUTRecep>11111111-1</RUTRecep><RznSocRecep>Cliente de prueba</RznSocRecep></Receptor>
<Totales><MntNeto>10000</MntNeto><IVA>1900</IVA><MntTotal>11900</MntTotal></Totales>
</Encabezado><Detalle><NroLinDet>1</NroLinDet><NmbItem>Letrero</NmbItem><MontoItem>10000</MontoItem></Detalle>
</Documento></DTE>`) };
}
module.exports = { invoiceFile };

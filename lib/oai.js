import { escape } from './xml.js';

const formats = '<metadataFormat><metadataPrefix>oai_dc</metadataPrefix><schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema><metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace></metadataFormat>';
const argumentsFor = {Identify:[],ListMetadataFormats:['identifier'],ListSets:['resumptionToken'],GetRecord:['identifier','metadataPrefix'],ListIdentifiers:['metadataPrefix','from','until','set','resumptionToken'],ListRecords:['metadataPrefix','from','until','set','resumptionToken']};
const header = record => `<header><identifier>${escape(record.identifier)}</identifier><datestamp>${record.datestamp}</datestamp><setSpec>blog</setSpec></header>`;
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

export function oaiResponse(catalog, params, now = new Date()) {
  const verb = params.get('verb');
  let error;
  const fail = (code,message) => { error={code,message}; };
  if (!Object.hasOwn(argumentsFor,verb) || params.getAll('verb').length!==1) fail('badVerb','Specify one supported verb.');
  if (!error) for (const [key,value] of params) {
    if ((key!=='verb' && !argumentsFor[verb].includes(key)) || params.getAll(key).length!==1 || !value) { fail('badArgument','Unknown, empty, or repeated argument.');break; }
  }
  if (!error && params.has('resumptionToken')) {
    if (params.size!==2) fail('badArgument','resumptionToken is exclusive.');
    else fail('badResumptionToken','This repository returns complete lists without tokens.');
  }
  const needsPrefix=['GetRecord','ListIdentifiers','ListRecords'].includes(verb);
  if (!error && needsPrefix && (!params.has('metadataPrefix') || (verb==='GetRecord' && !params.has('identifier')))) fail('badArgument','Missing required argument.');
  if (!error && needsPrefix && params.get('metadataPrefix')!=='oai_dc') fail('cannotDisseminateFormat','Only oai_dc is supported.');
  const from=params.get('from'), until=params.get('until');
  if (!error && ((from&&!validDay(from)) || (until&&!validDay(until)) || (from&&until&&from>until))) fail('badArgument','Use an inclusive YYYY-MM-DD UTC range with from <= until.');
  const identified=params.has('identifier')?catalog.records.find(record=>record.identifier===params.get('identifier')):null;
  if (!error && params.has('identifier') && !identified) fail('idDoesNotExist','Unknown identifier.');
  let body='';
  if (!error) {
    if (verb==='Identify') {
      const earliest=catalog.records.map(record=>record.datestamp).sort()[0] || '1970-01-01';
      body=`<Identify><repositoryName>${escape(catalog.name)}</repositoryName><baseURL>${escape(catalog.baseURL)}</baseURL><protocolVersion>2.0</protocolVersion><adminEmail>${escape(catalog.email)}</adminEmail><earliestDatestamp>${earliest}</earliestDatestamp><deletedRecord>no</deletedRecord><granularity>YYYY-MM-DD</granularity></Identify>`;
    } else if (verb==='ListMetadataFormats') body=`<ListMetadataFormats>${formats}</ListMetadataFormats>`;
    else if (verb==='ListSets') body='<ListSets><set><setSpec>blog</setSpec><setName>Blog posts</setName></set></ListSets>';
    else if (verb==='GetRecord') body=`<GetRecord><record>${header(identified)}<metadata>${identified.xml}</metadata></record></GetRecord>`;
    else {
      const records=catalog.records.filter(record=>(!from||record.datestamp>=from)&&(!until||record.datestamp<=until)&&(!params.has('set')||params.get('set')==='blog'));
      if (!records.length) fail('noRecordsMatch','No matching records.');
      else body=`<${verb}>${records.map(record=>verb==='ListIdentifiers'?header(record):`<record>${header(record)}<metadata>${record.xml}</metadata></record>`).join('')}</${verb}>`;
    }
  }
  const attributes = error && ['badVerb','badArgument'].includes(error.code) ? '' : [...params].map(([key,value])=>` ${key}="${escape(value)}"`).join('');
  if (error) body=`<error code="${error.code}">${escape(error.message)}</error>`;
  return `<?xml version="1.0" encoding="UTF-8"?><OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd"><responseDate>${now.toISOString().replace(/\.\d{3}Z$/,'Z')}</responseDate><request${attributes}>${escape(catalog.baseURL)}</request>${body}</OAI-PMH>`;
}

export async function handleOai(request,catalog) {
  if (!['GET','POST'].includes(request.method)) return new Response('Use GET or POST.',{status:405,headers:{Allow:'GET, POST'}});
  let params=new URL(request.url).searchParams;
  if (request.method==='POST') {
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Use application/x-www-form-urlencoded.',{status:415});
    const body=await request.text();
    if (body.length>8192) return new Response('Request too large.',{status:413});
    params=new URLSearchParams([...params,...new URLSearchParams(body)]);
  }
  return new Response(oaiResponse(catalog,params),{headers:{'Content-Type':'text/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
}

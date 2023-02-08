import envvar from 'env-var';
import * as N3 from 'n3';
const { namedNode } = N3.DataFactory;

export const TEMP_GRAPH_PREFIX = envvar
  .get('TEMP_GRAPH_PREFIX')
  .default('http://eredienst-mandatarissen-consumer/temp')
  .asUrlString();

export const TEMP_GRAPH_INSERTS = `${TEMP_GRAPH_PREFIX}-inserts`;
export const TEMP_GRAPH_DELETES = `${TEMP_GRAPH_PREFIX}-deletes`;

export const ORGANISATION_GRAPH_PREFIX = envvar
  .get('ORGANISATION_GRAPH_PREFIX')
  .default('http://mu.semte.ch/graphs/organizations/')
  .asUrlString();

export const LOGLEVEL = envvar
  .get('LOGLEVEL')
  .default('silent')
  .asEnum(['error', 'info', 'silent']);

export const WRITE_ERRORS = envvar
  .get('WRITE_ERRORS')
  .default('false')
  .asBool();

export const ERROR_GRAPH = envvar
  .get('ERROR_GRAPH')
  .default('http://lblod.data.gift/errors')
  .asUrlString();

export const ERROR_BASE = envvar
  .get('ERR0R_BASE')
  .default('http://data.lblod.info/errors/')
  .asUrlString();

const PREFIXES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  mu: 'http://mu.semte.ch/vocabularies/core/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  pav: 'http://purl.org/pav/',
  oslc: 'http://open-services.net/ns/core#',
  dct: 'http://purl.org/dc/terms/',
  ere: 'http://data.lblod.info/vocabularies/erediensten/',
  org: 'http://www.w3.org/ns/org#',
  besluit: 'http://data.vlaanderen.be/ns/besluit#',
  gen: 'http://data.vlaanderen.be/ns/generiek#',
  mandaat: 'http://data.vlaanderen.be/ns/mandaat#',
  persoon: 'http://data.vlaanderen.be/ns/persoon#',
  person: 'http://www.w3.org/ns/person#',
  adms: 'http://www.w3.org/ns/adms#',
  schema: 'http://schema.org/',
  locn: 'http://www.w3.org/ns/locn#',
};

const BASE = {
  error: 'http://data.lblod.info/errors/',
};

export const NAMESPACES = (() => {
  const all = {};
  for (const key in PREFIXES)
    all[key] = (pred) => namedNode(`${PREFIXES[key]}${pred}`);
  return all;
})();

export const BASES = (() => {
  const all = {};
  for (const key in BASE) all[key] = (pred) => namedNode(`${BASE[key]}${pred}`);
  return all;
})();

export const SPARQL_PREFIXES = (() => {
  const all = [];
  for (const key in PREFIXES) all.push(`PREFIX ${key}: <${PREFIXES[key]}>`);
  return all.join('\n');
})();

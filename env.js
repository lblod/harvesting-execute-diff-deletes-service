import envvar from 'env-var';
import * as N3 from 'n3';
const { namedNode } = N3.DataFactory;

export const TARGET_GRAPH = namedNode(
  envvar
    .get('TARGET_GRAPH')
    .default('http://mu.semte.ch/graphs/public')
    .asUrlString()
);

export const LOGLEVEL = envvar
  .get('LOGLEVEL')
  .default('silent')
  .asEnum(['error', 'info', 'silent']);

export const WRITE_ERRORS = envvar
  .get('WRITE_ERRORS')
  .default('false')
  .asBool();

export const ERROR_GRAPH = namedNode(
  envvar
    .get('ERROR_GRAPH')
    .default('http://lblod.data.gift/errors')
    .asUrlString()
);

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
  nfo: 'http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#',
  nie: 'http://www.semanticdesktop.org/ontologies/2007/01/19/nie#',
  dbpedia: 'http://dbpedia.org/ontology/',
  task: 'http://redpencil.data.gift/vocabularies/tasks/',
  tasko: 'http://lblod.data.gift/id/jobs/concept/TaskOperation/',
  services: 'http://lblod.data.gift/services/',
  js: 'http://redpencil.data.gift/id/concept/JobStatus/',
  asj: 'http://data.lblod.info/id/automatic-submission-job/',
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

export const TASK_ONGOING_STATUS = NAMESPACES.js`busy`;
export const TASK_SUCCESS_STATUS = NAMESPACES.js`success`;
export const TASK_FAILURE_STATUS = NAMESPACES.js`failed`;

export const OPERATION_PREDICATE = NAMESPACES.task`operation`;
export const EXECUTE_DELETES_OPERATION = NAMESPACES.tasko`execute-diff-deletes`;

export const CREATOR = NAMESPACES.services`harvester-execute-diff-deletes-service`;

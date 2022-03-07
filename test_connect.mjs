
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';

(async ()=>{
    const sparqlEndpoint = 'http://localhost:3030/dataset/test';

    let query = `
        CONSTRUCT { ?s ?p ?o. }
        WHERE { GRAPH <meta:http://localhost:3001/test101/.acl> { ?s ?p ?o. } }
    `;
    const fetcher = new SparqlEndpointFetcher();
    const tripleStream = await fetcher.fetchTriples(sparqlEndpoint, query);
    tripleStream.on('data', (triple) => console.log(triple));
    // const bindingsStream = await fetcher.fetchBindings(sparqlEndpoint, 'SELECT * WHERE { ?s ?p ?o } LIMIT 100');
    // bindingsStream.on('data', (bindings) => console.log(bindings));

    // const tripleStream = await fetcher.fetchTriples('https://dbpedia.org/sparql', 'CONSTRUCT { ?s ?p ?o }');
    // tripleStream.on('data', (triple) => console.log(triple));

    // const bindingsStream = await fetcher.fetchBindings('https://dbpedia.org/sparql', 'SELECT * WHERE { ?s ?p ?o } LIMIT 100');
    // bindingsStream.on('data', (bindings) => console.log(bindings));

    //process.exit(0);
})();
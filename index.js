const core = require('@actions/core');
const github = require('@actions/github');
const graphql = require('@octokit/graphql')

try {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  // console.log(`Hello ${nameToGreet}!`);

  // Example on how to set an output
  //const time = (new Date()).toTimeString();
  //core.setOutput("time", time);

  // Get the JSON webhook payload for the event that triggered the workflow
//   const payload = JSON.stringify(github.context.payload, undefined, 2)
//   console.log(`The event payload: ${payload}`);

    const graphqlWithAuth = graphql.defaults({
        headers: {
        authorization: GITHUB_TOKEN
        }
    });
    const { vulnerability } = await graphqlWithAuth(`
        {
            securityVulnerabilities(ecosystem: MAVEN, first:10, package:"com.hotels.styx:styx-api"){
                nodes{
                    firstPatchedVersion{identifier},
                    severity,
                    updatedAt,
                    vulnerableVersionRange
                }
            }
        }
    `);

    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);
    
} catch (error) {
  core.setFailed(error.message);
}
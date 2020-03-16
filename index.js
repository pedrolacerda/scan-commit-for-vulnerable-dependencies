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

    const { vulnerability } = graphql(` query getVulnerability($ecosystem: String!, $package: String!){ 
        securityVulnerabilities(ecosystem:$ecosystem:, first:10, package:$package) {
            nodes {
                firstPatchedVersion { identifier },
                severity,
                updatedAt,
                vulnerableVersionRange
            }
        }
    }`, {
        ecosystem: "MAVEN",
        package: "com.hotels.styx:styx-api",
        headers: {
            authorization: GITHUB_TOKEN
        }
    })


    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);

} catch (error) {
  core.setFailed(error.message);
}
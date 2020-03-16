const core = require('@actions/core');
const github = require('@actions/github');

async function getVulnerability(context){
    let octokit = new github.GitHub(process.env.GITHUB_TOKEN);
    let query = ` 
    query { 
        securityVulnerabilities(ecosystem: MAVEN, first:10, package:"com.hotels.styx:styx-api") {
            nodes {
                firstPatchedVersion { identifier },
                severity,
                updatedAt,
                vulnerableVersionRange
            }
        }
    }`

    return await octokit.graphql(query, {
        headers: {
            authorization: 'token ' + process.env.GITHUB_TOKEN
        }
    });
}

try {
    let context = github.context

    let queryReturn = getVulnerability(context)
    console.log(`The query return: ${queryReturn}`);

} catch (error) {
  core.setFailed(error.message);
}
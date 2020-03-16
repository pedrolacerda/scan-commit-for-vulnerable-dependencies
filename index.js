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
            authorization: `token Bearer ${core.getInput('GITHUB_TOKEN')}`
        }
    });
}

try {
    let context = github.context
    console.log(`GitHub Token ${core.getInput('GITHUB_TOKEN')}`)


    getVulnerability(context).then(function(values) {
        console.log(values)
    })


} catch (error) {
  core.setFailed(error.message);
}
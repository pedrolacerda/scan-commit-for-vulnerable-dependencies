const core = require('@actions/core');
const github = require('@actions/github');

async function getVulnerability(context){
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN');
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
            authorization: `token ${core.getInput('GITHUB_TOKEN')}`
        }
    });
}

try {
    let context = github.context
    console.log(`GitHub Token ${core.getInput('GITHUB_TOKEN')}`)

    getVulnerability(context).then(function(values) {
        console.log('Promise values');
        console.log(values);

    }).catch( error => {
        core.setFailed(error.message);
        console.log(error)
        }
    ); 

} catch (error) {
  core.setFailed(error.message);
}
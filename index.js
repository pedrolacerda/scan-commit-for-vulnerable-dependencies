const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');

async function getVulnerability(vulnerability, ecosystem){
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));
    let query = ` 
    query { 
        securityVulnerabilities(ecosystem: MAVEN, first:1, package:"com.hotels.styx:styx-api") {
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
    console.log(`The event name: ${context.eventName}`);

    if(context.eventName == `pull_request`){
        const payload = JSON.stringify(github.context.payload, undefined, 2);
        // console.log(`The event payload:\n ${payload}`);

        let patterns =['**/.xml']
        let globber = await glob.create(patterns.join('\n'))
        let files = await globber.glob()

        console.log(files)

        getVulnerability().then(function(values) {
            console.log('Promise values');
            console.log(values.securityVulnerabilities.nodes);
            core.setFailed('Forcing error');

        }).catch( error => {
            core.setFailed(error.message);
            console.log(error)
            }
        );
    } else {
        core.setFailed(`This action was not triggered by a Pull Request`);
    }
    
} catch (error) {
  core.setFailed(error.message);
}
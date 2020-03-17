const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');

/*
 * Get a specific vulerability
 * @params package(String):   full URI of the package 
 * @params ecosystem(String): ecosystem from the list [RUBYGEMS,NPM,PIP,MAVEN,NUGET,COMPOSER]
 */
async function getVulnerability(package, ecosystem) {
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

/*
 * Get all files from a PR
 */
async function getPrFiles(prNumber, owner, repo) {
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));

    let { data: pullRequest } = await octokit.pulls.listFiles({
        owner: owner,
        repo: repo,
        pull_number: prNumber
    })

    console.log(`Pull Request Data\n ${JSON.stringify(pullRequest, undefined, 2)}`)
}

/*
 * Get a list of languages used on the repo
 */
async function getLanguageList(owner, repo) {
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));

    let { data: languageList } = await octokit.repos.listLanguages({
        owner: owner,
        repo: repo    
    })

    console.log(`Repo's Language list\n ${JSON.stringify(languageList, undefined, 2)}`)
}

try {
    let context = github.context
    console.log(`The event name: ${context.eventName}`);

    if(context.eventName == `pull_request`){
        const payload = JSON.stringify(github.context.payload, undefined, 2);
        // console.log(`The event payload:\n ${payload}`);

        // getVulnerability().then(function(values) {
        //     console.log('Promise values');
        //     console.log(values.securityVulnerabilities.nodes);
        // }).catch( error => {
        //     core.setFailed(error.message);
        //     console.log(error)
        //     }
        // );

        getLanguageList(context.payload.repository.owner.login, context.payload.repository.name).then(function(values) {
            console.log('Promise values');
            console.log(values);
        }).catch( error => {
            core.setFailed(error.message);
            console.log(error)
            }
        );

        getPrFiles(context.payload.number, context.payload.repository.owner.login, context.payload.repository.name).then(function(values) {
            console.log('Promise values');
            console.log(values);
        }).catch( error => {
            core.setFailed(error.message);
            console.log(error)
            }
        );

        core.setFailed('Forcing error');

    } else {
        core.setFailed(`This action was not triggered by a Pull Request`);
    }
    
} catch (error) {
  core.setFailed(error.message);
}
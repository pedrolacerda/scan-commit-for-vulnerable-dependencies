const core = require('@actions/core');
const github = require('@actions/github');
const https = require('https')
const fs = require ('fs')

// [TO-DO] Make it smarter later on
const languagesEcosystems = [
    {   language: 'Ruby',
        ecosystem: 'RUBYGEMS',
        file: 'Gemfile'
    },
    {   language: 'Javascript',
        ecosystem: 'NPM',
        file: 'package.json'
    },
    {   language: 'Python',
        ecosystem: 'PIP',
        file: 'requirements.txt'
    },
    {   language: 'Java',
        ecosystem: 'MAVEN',
        file: 'pom.xml'
    },
    {   language: 'C#',
        ecosystem: 'NUGET',
        file: '.nuspec'
    },
    {   language: 'PHP',
        ecosystem: 'COMPOSER',
        file: 'composer.json'
    }
]

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

    let {data: files} = await octokit.pulls.listFiles({
        owner: owner,
        repo: repo,
        pull_number: prNumber
    })

    return files
}

/*
 * Get a list of languages used on the repo
 */
async function getLanguageList(owner, repo) {
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));

    let {data: languageList } =  await octokit.repos.listLanguages({
        owner: owner,
        repo: repo    
    })

    return languageList
}

/*
 * Get the content of a file
 */
async function getFileInCommit(owner, repo, path, ref) {
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));
    
    let {data: fileInCommity } =  await octokit.repos.getContents({
        owner: owner,
        repo: repo,
        path: path,
        ref: ref    
    })

    return fileInCommity
}

try {
    let context = github.context

    if(context.eventName == `pull_request`){

        // getVulnerability().then(function(values) {
        //     console.log('---------------- Promise values ----------------');
        //     console.log(values.securityVulnerabilities.nodes);
        // }).catch( error => {
        //     core.setFailed(error.message);
        //     console.log(error)
        //     }
        // );
        let languagesEcosystemsInPR

        getLanguageList(context.payload.repository.owner.login, context.payload.repository.name).then( languages => {
            // Checks if the PR has commits with languages in the ecosystem
            // and creates a list with them
            languagesEcosystemsInPR = languagesEcosystems.filter(language => typeof languages[language.language] !== "undefined")

        }).catch( error => {
            core.setFailed(error.message);
            console.log(error)
            }
        );

        getPrFiles(context.payload.number, context.payload.repository.owner.login, context.payload.repository.name).then( files => {
            console.log(`PR Files\n: ${JSON.stringify(files, undefined, 2)}`)
            
            files.forEach( function(file) {
                
                //Checks if dependency files were changed
                var dependencyFileName = languagesEcosystemsInPR.find(dependencyFile => dependencyFile.file.endsWith(file.filename))


                if(typeof dependencyFileName !== "undefined") {
                    console.log(`The dependency file ${file.filename} was changed`)
                    console.log(`Commit sha: ${file.sha}`)
                    console.log(`Patch: ${file.patch}`)

                    let fileChanged = getFileInCommit(context.payload.repository.owner.login, context.payload.repository.name, file.filename, file.sha)

                    console.log(`fileChanged: ${fileChanged}`)
                }
            })
                

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
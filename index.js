const core = require('@actions/core');
const github = require('@actions/github');
const DOMParser = require('xmldom').DOMParser;

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
        securityVulnerabilities(ecosystem:MAVEN, first:100, package:"com.fasterxml.jackson.core:jackson-databind") {
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

//akjhf lkajshd flkahsj dkjfahskljdfh askjlh fkjsd
async function getFileInCommit(owner, repo, path, ref) {
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));
    
    let {data: fileInCommity } =  await octokit.repos.getContents({
        owner: owner,
        repo: repo,
        path: path,
        ref: ref,
        mediaType: {
            format: 'raw'
        }
    })

    return fileInCommity
}

try {
    let context = github.context

    if(context.eventName == `pull_request`){
        let languagesEcosystemsInPR

        getLanguageList(context.payload.repository.owner.login, context.payload.repository.name).then( languages => {

            // Checks if the PR has commits with languages in the ecosystem
            // and creates a list with them
            languagesEcosystemsInPR = languagesEcosystems.filter(language => typeof languages[language.language] !== "undefined")

        }).catch( error => {
            core.setFailed(error.message);
            }
        );

        getPrFiles(context.payload.number, context.payload.repository.owner.login, context.payload.repository.name)
        .then( async files => {            

            //Needs to have at least one language that GitHub scans vulnerabilities
            if(typeof languagesEcosystemsInPR !== 'undefined'){
                files.forEach( file => {

                    //Checks if dependency files were changed
                    var dependencyFileName = languagesEcosystemsInPR.find(dependencyFile => dependencyFile.file.endsWith(file.filename))

                    if(typeof dependencyFileName !== "undefined") {
                        console.log(`The dependency file ${file.filename} was changed`)
                        let ecosystem = 'MAVEN'

                        //Get file content to scan each vulnerability
                        getFileInCommit(context.payload.repository.owner.login, context.payload.repository.name, file.filename, context.payload.pull_request.head.ref)
                        .then( async fileChanged => {

                            // console.log(`Arquivo:\n ${fileChanged}`)

                            let parser = new DOMParser()
                            let xmlDoc = parser.parseFromString(fileChanged)
                            
                            // // These are the two tags that add packages to the repo
                            let groupIds = xmlDoc.getElementsByTagName('groupId')
                            let artifactIds = xmlDoc.getElementsByTagName('artifactId')
                            let artifactVersions = xmlDoc.getElementsByTagName('version')

                            let hasVulnerabilities = false

                            for(i = 0; i < groupIds["$$length"]; i++) {

                                let package = `${groupIds[i]['childNodes']}:${artifactIds[i]['childNodes']}`
                                let version = artifactVersions[i]['childNodes']
                                let minimumVersion = ""

                                // console.log(`package: ${package}`)
                                // console.log(`version: ${version}`)
                                
                                // Loop over the list of vulnerabilities of a package
                                getVulnerability(package, ecosystem).then( async function(values) {
                                    console.log(`Vulnerabilities:\n ${values}`)
                                    // if(typeof values !== "undefined"){
                                    //     hasVulnerabilities = true

                                    //     let vulerabilities = values.securityVulnerabilities.nodes
                                    //     vulerabilities.forEach(vulnerability => {
                                    //         if((version < vulnerability.firstPatchedVersion.identifier) && (vulnerability.firstPatchedVersion.identifier > minimumVersion)){
                                    //             minimumVersion = vulnerability.firstPatchedVersion.identifier
                                    //         }
                                    //     })
                                    // }
                                    // if(hasVulnerabilities) core.setFailed(`There's a vulnerability in the package ${package}, please update to the version ${minimumVersion}`)
                                }).catch( error => {
                                    core.setFailed(error.message)
                                    console.log(error)
                                })
                            }
                        }).catch(error => {
                            core.setFailed(error.message)
                            console.log(error)
                        });
                    }
               }) 
            } else {
                core.setFailed("We can't check for vulnerabilities for any of the languages on this repository")
            } 

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
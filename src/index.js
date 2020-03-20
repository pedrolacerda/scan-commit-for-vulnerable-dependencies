const core = require('@actions/core');
const github = require('@actions/github');
const DOMParser = require('xmldom').DOMParser;
const semver = require('semver');

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
        securityVulnerabilities(ecosystem:${ecosystem}, first:100, package:"${package}") {
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
async function getPrFiles(octokit, prNumber, owner, repo) {

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
async function getLanguageList(octokit, owner, repo) {

    let {data: languageList } =  await octokit.repos.listLanguages({
        owner: owner,
        repo: repo    
    })

    return languageList
}

/*
 * Get the content of a file
 */
async function getFileInCommit(octokit, owner, repo, path, ref) {
  
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

function getVersionValue(versionVariable, xmlDoc){

    var version = semver.valid(semver.coerce(versionVariable.toString()))
    //if the version value is explicit return it formated
    if(version != null && typeof version !== "undefined") {
        return version
    } else { // If the version value is a variable or null

        let versionVariableTrimmed = versionVariable.toString().replace('{','').replace('}','').replace('$','')
        let versionValue = xmlDoc.getElementsByTagName(versionVariableTrimmed)
        
        //If it's not possible to find a node with version name, return an empty string
        if(versionValue == null || typeof versionValue === "undefined" || versionValue == "")   return ""

        //otherwise, return the value of the node
        else return semver.valid(semver.coerce(versionValue[0]["childNodes"].toString()))
    }
}

try {
    let octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));
    let context = github.context

    if(context.eventName == `pull_request`){
        let languagesEcosystemsInPR

        getLanguageList(octokit, context.payload.repository.owner.login, context.payload.repository.name).then( languages => {

            // Checks if the PR has commits with languages in the ecosystem
            // and creates a list with them
            languagesEcosystemsInPR = languagesEcosystems.filter(language => typeof languages[language.language] !== "undefined")

        }).catch( error => {
            core.setFailed(error.message);
            }
        );

        getPrFiles(octokit, context.payload.number, context.payload.repository.owner.login, context.payload.repository.name)
        .then( async files => {            

            //Needs to have at least one language that GitHub scans vulnerabilities
            if(typeof languagesEcosystemsInPR !== 'undefined'){
                files.forEach( file => {

                    //Checks if dependency files were changed
                    var dependencyFileName = languagesEcosystemsInPR.find(dependencyFile => dependencyFile.file.endsWith(file.filename))

                    if(typeof dependencyFileName !== "undefined") {
                        console.log(`The dependency file ${file.filename} was changed`)
                        let ecosystem = dependencyFileName.ecosystem
                        console.log(`Ecosystem is: ${ecosystem}`)
                        var dependencyFileParser
                        switch(ecosystem) {
                            case 'RUBYGEMS':
                                dependencyFileParser = require('./rubygems-parser.js')
                                break;
                            case 'NPM':
                                dependencyFileParser = require('./npm-parser.js')
                                break;
                            case 'PIP':
                                dependencyFileParser = require('./pip-parser.js')
                                break;
                            case 'MAVEN':
                                dependencyFileParser = require('./mvn-parser.js')
                                break;  
                            case 'NUGET':
                                dependencyFileParser = require('./nuget-parser.js')
                                break;                            
                            case 'COMPOSER':
                                dependencyFileParser = require('./composer-parser.js')
                                break;
                            default:
                                core.setFailed("The ecosystem is not supported yet")
                          }

                        //Get file content to scan each vulnerability
                        getFileInCommit(context.payload.repository.owner.login, context.payload.repository.name, file.filename, context.payload.pull_request.head.ref)
                        .then( async fileChanged => {

                            let parser = new DOMParser()
                            let xmlDoc = parser.parseFromString(fileChanged)
                            
                            // // These are the two tags that add packages to the repo
                            let groupIds = xmlDoc.getElementsByTagName('groupId')
                            let artifactIds = xmlDoc.getElementsByTagName('artifactId')
                            let artifactVersions = xmlDoc.getElementsByTagName('version')

                            for(i = 0; i < groupIds["$$length"]; i++) {

                                let package = `${groupIds[i]['childNodes']}:${artifactIds[i]['childNodes']}`
                                let version = getVersionValue(artifactVersions[i]['childNodes'], xmlDoc)
                                let hasVulnerabilities = false
                                let minimumVersion = ""
                                // Loop over the list of vulnerabilities of a package
                                getVulnerability(package, ecosystem).then( async function(values) {
                                    if(typeof values !== "undefined"){
                                        minimumVersion = "0.0"

                                        let vulerabilities = values.securityVulnerabilities.nodes

                                        vulerabilities.forEach( vulnerability => {
                                            if(vulnerability.firstPatchedVersion != null && typeof vulnerability.firstPatchedVersion !== 'undefined'){
                                                
                                                // If the version of the package used is lower than the first patched version
                                                // AND the first patched version of the package is bigger than minimun version registered so far
                                                if((semver.compare(semver.valid(semver.coerce(version.toString())), semver.valid(semver.coerce(vulnerability.firstPatchedVersion.identifier.toString()))) == -1)
                                                && (semver.compare(semver.valid(semver.coerce(vulnerability.firstPatchedVersion.identifier.toString())), semver.valid(semver.coerce(minimumVersion.toString()))) == 1)){
                                                    minimumVersion = vulnerability.firstPatchedVersion.identifier
                                                    hasVulnerabilities = true
                                                }
                                            }
                                        })
                                        if(hasVulnerabilities) core.setFailed(`There's a vulnerability in the package ${package}, please update to version ${minimumVersion}`)

                                    }
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
    } else {
        core.setFailed(`This action was not triggered by a Pull Request`);
    }
    
} catch (error) {
  core.setFailed(error.message);
}






/* 
;lasdjkf; lkasjd fl;kasjd;flkjasdf
*/

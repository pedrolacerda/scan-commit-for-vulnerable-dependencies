const core = require('@actions/core');
const github = require('@actions/github');
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
                        let ecosystem = dependencyFileName.ecosystem
                        console.log(`Ecosystem is: ${ecosystem}`)
                        var dependencyFileParser
                        switch(ecosystem) {
                            case 'RUBYGEMS':
                                dependencyFileParser = require('./parsers/rubygems-parser.js')
                                break;
                            case 'NPM':
                                dependencyFileParser = require('./parsers/npm-parser.js')
                                break;
                            case 'PIP':
                                dependencyFileParser = require('./parsers/pip-parser.js')
                                break;
                            case 'MAVEN':
                                dependencyFileParser = require('./parsers/mvn-parser.js')
                                break;  
                            case 'NUGET':
                                dependencyFileParser = require('./parsers/nuget-parser.js')
                                break;                            
                            case 'COMPOSER':
                                dependencyFileParser = require('./parsers/composer-parser.js')
                                break;
                            default:
                                core.setFailed("The ecosystem is not supported yet")
                          }

                        //Get file content to scan each vulnerability
                        getFileInCommit(context.payload.repository.owner.login, context.payload.repository.name, file.filename, context.payload.pull_request.head.ref)
                        .then( async fileChanged => {

                            await dependencyFileParser.pomXmlParser(fileChanged)

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


/* asjdfhkasjdhf
*/
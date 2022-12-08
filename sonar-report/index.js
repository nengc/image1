#!/usr/bin/env node
const argv = require("minimist")(process.argv.slice(2));
const got = require('got');
const tunnel = require('tunnel');
const ejs = require("ejs");

if (argv.help) {
  console.log(`SYNOPSIS
    sonar-report [OPTION]...

USAGE
    sonar-report --project=MyProject --application=MyApp --release=v1.0.0 --sonarurl=http://my.sonar.example.com --sonarcomponent=myapp:1.0.0 --sinceleakperiod=true > /tmp/sonar-report

DESCRIPTION
    Generate a vulnerability report from a SonarQube instance.

    Environment: 
    http_proxy : the proxy to use to reach the sonarqube instance (http://<host>:<port>)

    Parameters: 
    --project
        name of the project, displayed in the header of the generated report

    --application
        name of the application, displayed in the header of the generated report

    --release
        name of the release, displayed in the header of the generated report

    --branch
        Branch in Sonarqube that we want to get the issues for

    --sonarurl
        base URL of the SonarQube instance to query from

    --sonarcomponent
        id of the component to query from

    --sonarusername
        auth username

    --sonarpassword
        auth password

    --sonartoken
        auth token

    --sonarorganization
        name of the sonarcloud.io organization

    --sinceleakperiod
        flag to indicate if the reporting should be done since the last sonarqube leak period (delta analysis). Default is false.

    --allbugs
        flag to indicate if the report should contain all bugs, not only vulnerabilities. Default is false

    --fixMissingRule
        Extract rules without filtering on type (even if allbugs=false). Not useful if allbugs=true. Default is false

    --noSecurityHotspot
        Set this flag for old versions of sonarQube without security hotspots (<7.3?). Default is false

    --help
        display this help message`);
  process.exit();
}

function logError(context, error){
  var errorCode = (typeof error.code === 'undefined' || error.code === null) ? "" : error.code;
  var errorMessage = (typeof error.message === 'undefined' || error.message === null) ? "" : error.message;
  var errorResponseStatusCode = (typeof error.response === 'undefined' || error.response === null || error.response.statusCode === 'undefined' || error.response.statusCode === null ) ? "" : error.response.statusCode;
  var errorResponseStatusMessage = (typeof error.response === 'undefined' || error.response === null || error.response.statusMessage === 'undefined' || error.response.statusMessage === null ) ? "" : error.response.statusMessage;
  var errorResponseBody = (typeof error.response === 'undefined' || error.response === null || error.response.body === 'undefined' || error.response.body === null ) ? "" : error.response.body;

  console.error(
    "Error while %s : %s - %s - %s - %s - %s", 
    context, errorCode, errorMessage, errorResponseStatusCode, errorResponseStatusMessage,  errorResponseBody);  
}

(async () => {
  var severity = new Map();
  severity.set('MINOR', 0);
  severity.set('MAJOR', 1);
  severity.set('CRITICAL', 2);
  severity.set('BLOCKER', 3);

  const data = {
    date: new Date().toDateString(),
    projectName: argv.project,
    applicationName: argv.application,
    releaseName: argv.release,
    branch: argv.branch,
    sinceLeakPeriod: (argv.sinceleakperiod == 'true'),
    previousPeriod: '',
    allBugs: (argv.allbugs == 'true'),
    fixMissingRule: (argv.fixMissingRule == 'true'),
    noSecurityHotspot: (argv.noSecurityHotspot == 'true'),
    // sonar URL without trailing /
    sonarBaseURL: argv.sonarurl.replace(/\/$/, ""),
    sonarOrganization: argv.sonarorganization,
    rules: [],
    issues: [],
    hotspots: []
  };

  const leakPeriodFilter = data.sinceLeakPeriod ? '&sinceLeakPeriod=true' : '';
  data.deltaAnalysis = data.sinceLeakPeriod ? 'Yes' : 'No';
  const sonarBaseURL = data.sonarBaseURL;
  const sonarComponent = argv.sonarcomponent;
  const withOrganization = data.sonarOrganization ? `&organization=${data.sonarOrganization}` : '';
  var headers = {};

  let DEFAULT_FILTER="";
  let OPEN_STATUSES="";
  // Default filter gets only vulnerabilities
  if(data.noSecurityHotspot){
    // For old versions of sonarQube (sonarQube won't accept filtering on a type that doesn't exist and will give HTTP 400 {"errors":[{"msg":"Value of parameter 'types' (SECURITY_HOTSPOT) must be one of: [CODE_SMELL, BUG, VULNERABILITY]"}]})
    DEFAULT_FILTER="&types=VULNERABILITY"
    OPEN_STATUSES="OPEN,CONFIRMED,REOPENED"
  }
  else{
    // For newer versions of sonar, rules and issues may be of type VULNERABILITY or SECURITY_HOTSPOT
    DEFAULT_FILTER="&types=BUG, VULNERABILITY", "CODE_SMELL"//, CODE_SMELL
    // the security hotspot adds TO_REVIEW,IN_REVIEW
    // OPEN_STATUSES="OPEN,CONFIRMED,REOPENED,TO_REVIEW,IN_REVIEW"
    OPEN_STATUSES="OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED"
  }

  // filters for getting rules and issues
  let filterRule = DEFAULT_FILTER;
  let filterIssue = DEFAULT_FILTER;

  if(data.allBugs){
    filterRule = "";
    filterIssue = "";
  }

  if(data.branch){
    filterIssue=filterIssue + "&branch=" + data.branch
  }

  if(data.fixMissingRule){
    filterRule = "";
  }

  let useSql=true;

  var proxy = null;
  // the tunnel agent if a forward proxy is required, or remains null
  var agent = null;
  // Preparing configuration if behind proxy
  if (process.env.http_proxy){
    proxy = process.env.http_proxy;
    var url = new URL(proxy);
    var proxyHost = url.hostname;
    var proxyPort = url.port;
    console.error('using proxy %s:%s', proxyHost, proxyPort);
    agent = {
      https: tunnel.httpsOverHttp({
          proxy: {
              host: proxyHost,
              port: proxyPort
          }
      })
    };
    
  }
  else{
    console.error('No proxy configuration detected');
  }

  const username = argv.sonarusername;
  const password = argv.sonarpassword;
  const token = argv.sonartoken;
  if (username && password) {
    // Form authentication with username/password
    try {
      const response = await got.post(`${sonarBaseURL}/api/authentication/login`, {
          agent,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `login=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      });
      headers["Cookie"] = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    } catch (error) {
        logError("while logging in", error);
        return null;
    }
    
  } else if (token) {
    // Basic authentication with user token
    headers["Authorization"] = "Basic " + Buffer.from(token + ":").toString("base64");
  }

  if (data.sinceLeakPeriod) {
    const res = request(
      "GET",
      `${sonarBaseURL}/api/settings/values?keys=sonar.leak.period`,
      {headers}
    );
    const json = JSON.parse(res.getBody());
    data.previousPeriod = json.settings[0].value;
  }

  {
    const pageSize = 500;
    let page = 1;
    let nbResults;

  do {
      try {
          const response = await got(`${sonarBaseURL}/api/rules/search?activation=true&ps=${pageSize}&p=${page}${filterRule}`, {
              agent,
              headers
          });
          page++;
          const json = JSON.parse(response.body);
          nbResults = json.rules.length;
          data.rules = data.rules.concat(json.rules.map(rule => ({
          key: rule.key,
          htmlDesc: rule.htmlDesc,
          name: rule.name,
          severity: rule.severity
          })));
      } catch (error) {
          logError("while getting rules", error);
          return null;
      }
    } while (nbResults === pageSize);
  }

  {
    if(!useSql){
      const pageSize = 500;
      let page = 1;
      let nbResults;
        /** Get all statuses except "REVIEWED". 
         * Actions in sonarQube vs status in security hotspot (sonar >= 7): 
         * - resolve as reviewed
         *    "resolution": "FIXED"
         *    "status": "REVIEWED"
         * - open as vulnerability
         *    "status": "OPEN"
         * - set as in review
         *    "status": "IN_REVIEW"
         */
        do {
          try {
              const response = await got(`${sonarBaseURL}/api/issues/search?componentKeys=${sonarComponent}&ps=${pageSize}&p=${page}&statuses=${OPEN_STATUSES}&resolutions=&s=STATUS&asc=no${leakPeriodFilter}${filterIssue}${withOrganization}`, {
                  agent,
                  headers
              });
              page++;

              const json = JSON.parse(response.body);
              nbResults = json.issues.length;
              data.issues = data.issues.concat(json.issues.map(issue => {
                const rule = data.rules.find(oneRule => oneRule.key === issue.rule);
                const message = rule ? rule.name : "/";
                return {
                  rule: issue.rule,
                  // For security hotspots, the vulnerabilities show without a severity before they are confirmed
                  // In this case, get the severity from the rule
                  severity: (typeof issue.severity !== 'undefined') ? issue.severity : rule.severity,
                  status: issue.status,
                  // Take only filename with path, without project name
                  component: issue.component.split(':').pop(),
                  line: issue.line,
                  description: message,
                  message: issue.message,
                  key: issue.key,
                  type: issue.type,
                  line: issue.line
                };
              }));
          } catch (error) {
            logError("while getting issues", error);  
              return null;
          }
        } while (nbResults === pageSize);
    }else{

      const { Client } = require('pg')
      const client = new Client({
        user: 'sonar',
        host: 'localhost',
        database: 'sonar',
        password: '123456',
        port: 5432,
      })

      await client.connect()

      const res = await client.query(`select
      i.kee as key,
      i.rule_uuid as ruleUuid,
      i.severity as severity,
      i.manual_severity as manualSeverity,
      i.message as message,
      i.line as line,
      i.locations as locations,
      i.gap as gap,
      i.effort as effort,
      i.status as status,
      i.resolution as resolution,
      i.checksum as checksum,
      i.assignee as assigneeUuid,
      i.author_login as authorLogin,
      i.tags as tagsString,
      i.issue_attributes as issueAttributes,
      i.issue_creation_date as issueCreationTime,
      i.issue_update_date as issueUpdateTime,
      i.issue_close_date as issueCloseTime,
      i.created_at as createdAt,
      i.updated_at as updatedAt,
      r.is_external as "isExternal",
      r.plugin_rule_key as ruleKey,
      r.plugin_name as ruleRepo,
      r.language as language,
      p.kee as componentKey,
      i.component_uuid as componentUuid,
      p.module_uuid as moduleUuid,
      p.module_uuid_path as moduleUuidPath,
      p.path as filePath,
      root.kee as projectKey,
      i.project_uuid as projectUuid,
      i.issue_type as type
     
      from issues i
      inner join rules r on r.uuid=i.rule_uuid
      inner join components p on p.uuid=i.component_uuid
      inner join components root on root.uuid=i.project_uuid`)
      // console.log(res.rows[0].key) // Hello world!
      await client.end()

      const json = res.rows;
      nbResults = json.length;
      data.issues = data.issues.concat(json.map(issue => {
        const rule = data.rules.find(oneRule => oneRule.key === issue.rulerepo + ":" + issue.rulekey);
        const message = rule ? rule.name : "/";
        var issueType="";
        if(issue.type===1){
          issueType = "CODE_SMELL"
        }else if (issue.type===2){
          issueType = "BUG"
        }else if (issue.type===3){
          issueType = "VULNERABILITY"
        }
        return {
          rule: issue.rulerepo + ":" + issue.rulekey,
          // For security hotspots, the vulnerabilities show without a severity before they are confirmed
          // In this case, get the severity from the rule
          severity: (typeof issue.severity !== 'undefined') ? issue.severity : rule.severity,
          status: issue.status,
          // Take only filename with path, without project name
          component: issue.componentkey.replace(sonarComponent+":",""),
          line: issue.line,
          description: message,
          message: issue.message,
          key: issue.key,
          type: issueType,
        };
      }));

    }

    data.issues.sort(function (a, b) {
      return severity.get(b.severity) - severity.get(a.severity);
    });

    data.issues.bugs = {
      blocker: data.issues.filter(issue => issue.severity === "BLOCKER" && issue.type==="BUG"),
      critical: data.issues.filter(issue => issue.severity === "CRITICAL" && issue.type==="BUG"),
      major: data.issues.filter(issue => issue.severity === "MAJOR" && issue.type==="BUG"),
      minor: data.issues.filter(issue => issue.severity === "MINOR" && issue.type==="BUG"),
      info: data.issues.filter(issue => issue.severity === "INFO" && issue.type==="BUG")
    };
    data.issues.bugs.total = data.issues.filter(issue => issue.type==="BUG")

    data.issues.vulnerabilitys = {
      blocker: data.issues.filter(issue => issue.severity === "BLOCKER" && issue.type==="VULNERABILITY"),
      critical: data.issues.filter(issue => issue.severity === "CRITICAL" && issue.type==="VULNERABILITY"),
      major: data.issues.filter(issue => issue.severity === "MAJOR" && issue.type==="VULNERABILITY"),
      minor: data.issues.filter(issue => issue.severity === "MINOR" && issue.type==="VULNERABILITY"),
      info: data.issues.filter(issue => issue.severity === "INFO" && issue.type==="VULNERABILITY")
    };
    data.issues.vulnerabilitys.total = data.issues.filter(issue => issue.type==="VULNERABILITY")

    data.issues.codeSmells = {
      blocker: data.issues.filter(issue => issue.severity === "BLOCKER" && issue.type==="CODE_SMELL"),
      critical: data.issues.filter(issue => issue.severity === "CRITICAL" && issue.type==="CODE_SMELL"),
      major: data.issues.filter(issue => issue.severity === "MAJOR" && issue.type==="CODE_SMELL"),
      minor: data.issues.filter(issue => issue.severity === "MINOR" && issue.type==="CODE_SMELL"),
      info: data.issues.filter(issue => issue.severity === "INFO" && issue.type==="CODE_SMELL")
    };
    data.issues.codeSmells.total = data.issues.filter(issue => issue.type==="CODE_SMELL")
  
    data.summary = {}
    data.summary.bugs = {
      blocker: data.issues.bugs.blocker.length,
      critical: data.issues.bugs.critical.length,
      major: data.issues.bugs.major.length,
      minor: data.issues.bugs.minor.length,
      info: data.issues.bugs.info.length
    };
    data.summary.bugs.total = data.issues.filter(issue => issue.type==="BUG").length,
  
    data.summary.vulnerabilitys= {
      blocker: data.issues.vulnerabilitys.blocker.length,
      critical: data.issues.vulnerabilitys.critical.length,
      major: data.issues.vulnerabilitys.major.length,
      minor: data.issues.vulnerabilitys.minor.length,
      info: data.issues.vulnerabilitys.info.length
    };
    data.summary.vulnerabilitys.total = data.issues.filter(issue => issue.type==="VULNERABILITY").length,

    data.summary.codeSmells= {
      blocker: data.issues.codeSmells.blocker.length,
      critical: data.issues.codeSmells.critical.length,
      major: data.issues.codeSmells.major.length,
      minor: data.issues.codeSmells.minor.length,
      info: data.issues.codeSmells.info.length
    };
    data.summary.codeSmells.total = data.issues.filter(issue => issue.type==="CODE_SMELL").length
  }
  


  {
    const pageSize = 500;
    let page = 1;
    let nbResults;

      do {
        try {
            const response = await got(`${sonarBaseURL}/api/hotspots/search?projectKey=${sonarComponent}&ps=${pageSize}&p=${page}`, {
                agent,
                headers
            });
            page++;
            const json = JSON.parse(response.body);
            nbResults = json.hotspots.length;

            data.hotspots = data.hotspots.concat(json.hotspots.map(issue => {
              return issue;
            }));
        } catch (error) {
          logError("while getting issues", error);  
            return null;
        }
      } while (nbResults === pageSize);

    data.hotspots.low = data.hotspots.filter(hotspot => hotspot.vulnerabilityProbability === "LOW");
    data.hotspots.medium = data.hotspots.filter(hotspot => hotspot.vulnerabilityProbability === "MEDIUM");
    data.hotspots.high = data.hotspots.filter(hotspot => hotspot.vulnerabilityProbability === "HIGH");
  
    data.summary.hotspots = {
      high: data.hotspots.high.length,
      low: data.hotspots.low.length,
      medium: data.hotspots.medium.length,
    };
    data.summary.hotspots.total = data.hotspots.length

  }

  for (let index = 0; index < data.summary.bugs.total; index++) {
    const iss = data.issues.bugs.total[index];
    try {
      var fromTo=""
      if(iss.line !== undefined){
        fromTo = `&from=${iss.line - 6<1?1:iss.line - 6}&to=${iss.line + 6}`
      }
      await getSource(sonarComponent+":"+iss.component)
      const response = await got(`${sonarBaseURL}/api/sources/lines?key=${sonarComponent}:${iss.component}${fromTo}`, {
        agent,
        headers
      })
      const json = JSON.parse(response.body);
      iss.codeLine = json.sources.map(item=>{
        return item.line
      })

      iss.code = json.sources.map(item=>{
        // item.code = item.code.replace(/</g, '&lt;');
        // item.code = item.code.replace(/&/g, '&amp;');
        return item.code
      })
    }
    catch(error){

    }
  }

  for (let index = 0; index < data.summary.vulnerabilitys.total; index++) {
    const iss = data.issues.vulnerabilitys.total[index];
    try {
      var fromTo=""
      if(iss.line !== undefined){
        fromTo = `&from=${iss.line - 6<1?1:iss.line - 6}&to=${iss.line + 6}`
      }
      const response = await got(`${sonarBaseURL}/api/sources/lines?key=${sonarComponent}:${iss.component}${fromTo}`, {
        agent,
        headers
      })
      const json = JSON.parse(response.body);
      iss.codeLine = json.sources.map(item=>{
        return item.line
      })

      iss.code = json.sources.map(item=>{
        // item.code = item.code.replace(/</g, '&lt;');
        // item.code = item.code.replace(/&/g, '&amp;');
        return item.code
      })
    }
    catch(error){

    }
  }

  for (let index = 0; index < data.summary.codeSmells.total; index++) {
    const iss = data.issues.codeSmells.total[index];
    try {
      var fromTo=""
      if(iss.line !== undefined){
        fromTo = `&from=${iss.line - 6<1?1:iss.line - 6}&to=${iss.line + 6}`
      }
      const response = await got(`${sonarBaseURL}/api/sources/lines?key=${sonarComponent}:${iss.component}${fromTo}`, {
        agent,
        headers
      })
      const json = JSON.parse(response.body);
      iss.codeLine = json.sources.map(item=>{
        return item.line
      })

      iss.code = json.sources.map(item=>{
          // item.code = item.code.replace(/</g, '&lt;');
          // item.code = item.code.replace(/&/g, '&amp;');
          return item.code
      })
    }
    catch(error){

    }
  }



  for (let index = 0; index < data.summary.hotspots.total; index++) {
    const iss = data.hotspots[index];
    try {
      var fromTo=""
      if(iss.line !== undefined){
        fromTo = `&from=${iss.line - 6<1?1:iss.line - 6}&to=${iss.line + 6}`
      }
      const response = await got(`${sonarBaseURL}/api/sources/lines?key=${iss.component}${fromTo}`, {
        agent,
        headers
      })
      const json = JSON.parse(response.body);
      iss.codeLine = json.sources.map(item=>{
        return item.line
      })

      iss.code = json.sources.map(item=>{
          // item.code = item.code.replace(/</g, '&lt;');
          // item.code = item.code.replace(/&/g, '&amp;');
          return item.code
      })
    }
    catch(error){
      return null;
    }
  }

  ejs.renderFile(`${__dirname}/index.ejs`, data, {}, (err, str) => {
    // console.log(err);
    console.log(str);
  });
})();

function escape2Html(str) {
  var arrEntities={'lt':'<','gt':'>','nbsp':' ','amp':'&','quot':'"'};
  return str.replace(/&(lt|gt|nbsp|amp|quot);/ig,function(all,t){return arrEntities[t];});
 }
 
 function html2Escape(sHtml) {
  return sHtml.replace(/[<>&"]/g,function(c){return {'':'>','&':'&','"':'"'}[c];});  
}

async function getSource(component){
  const { Client } = require('pg')
  var lz4 = require('lz4')
  var fs = require('fs')


  const client = new Client({
    user: 'sonar',
    host: 'localhost',
    database: 'sonar',
    password: '123456',
    port: 5432,
  })

  await client.connect()

  const res = await client.query(`select
  uuid,
  project_uuid as projectUuid,
  file_uuid as fileUuid,
  created_at as createdAt,
  updated_at as updatedAt,
  binary_data as binaryData,
  line_hashes as rawLineHashes,
  line_hashes_version as lineHashesVersion,
  line_count as lineCount,
  data_hash as dataHash,
  src_hash as srcHash,
  revision
from
  file_sources
where
  file_uuid = (select c.uuid from components c where c.kee = '${component}')`)
  // console.log(res.rows[0].key) // Hello world!
  await client.end()
  const json = res.rows[0];
  var Buffer = require('buffer').Buffer

  // var fileBuffer = new Buffer(json.binarydata, 'binary' ); 
  // var file = fileBuffer.toString('utf8');

  // fs.appendFile('./tmp', Buffer.from(json.binarydata), function (err) {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     return json.binarydata.length;
  //   }
  // });

  try {

    // var decoder = lz4.createDecoderStream()

    // var input = fs.createReadStream('tmp')
    // var output = fs.createWriteStream('test')
    
    // input.pipe(decoder).pipe(output)

  // var output = lz4.decodeBlock(json.binarydata.buffer)

  var input = json.binarydata//fs.readFileSync('tmp.lz4')
  // Allocate output size... randomly :s
  var output = Buffer.alloc( input.length * 2 )
  var uncompressedBlockSize = lz4.decodeBlock(input, output)

  console.log(output.toString())
  
  if (uncompressedBlockSize > 0) {
    var fileSize = fs.statSync('tmp.lz4').size
    console.log(
      'lz4 block uncompressed %d bytes into %d bytes in %dms (%dMb/s)'
    ,	fileSize
    ,	uncompressedBlockSize
    ,	delta
    ,	delta > 0 ? Math.round( 100 * fileSize / ( delta * (1 << 20) ) * 1000 ) / 100 : 0
    )
    fs.writeFileSync( 'aaa', output.slice(0, uncompressedBlockSize) )
  } else {
    console.log('data could not be uncompressed')
  }


  console.log( output)


  }catch(e){
    console.log(e)
  }

  

  // var output = lz4.decode(json.binarydata.buffer)
  
  // console.log( output)
  
}

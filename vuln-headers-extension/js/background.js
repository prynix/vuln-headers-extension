// Declaring sets to remove displaying of duplicate URls
var corsSet = new Set();
var hostHeaderSet = new Set();
var clickjackingSet = new Set();

// Opens a new page to display the results
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    "url": "/display.html"
  });
});

function buildTag(urlx, pattern) {
  let className = "hidden";
  if(urlx.match(new RegExp(pattern, 'i'))) {
    className = "display";
  }
  return '<div class="' + className + '"><a href=' + urlx + ' target="_blank">' + urlx + '</a></div>';
}

// Adds custom headers to detect the existance of vulnerabilities
function addCustomHeaders(e) {

  // Flag to check for existance of X-Forwarded-Host header
  let xForwardedHostFlag = 0;

  // Malicious unique URLs (used as filters to detect vulnerabilities)
  let hostHeaderInjectionCheckUrl = "evilhosth3r0kU.com";
  let corsMisconfigurationCheckUrl = "http://evil.com";

  // Iterates all headers to find for X-Forwarded-Host header
  // If not found, this script will add the header and assigns malicious
  // value to the header
  for (var header of e.requestHeaders) {
    if (header.name == "X-Forwarded-Host") {
      header.value = "http://" + hostHeaderInjectionCheckUrl;
      xForwardedHostFlag = 1;
    }
  }
  if (xForwardedHostFlag == 0) {
    // Adds the header.
    e.requestHeaders.push({
      "name": "X-Forwarded-Host",
      "value": hostHeaderInjectionCheckUrl
    });
  }

  // Adds origin header with malicious URL to detect CORS vulnerability
  e.requestHeaders.push({
    "name": "Origin",
    "value": corsMisconfigurationCheckUrl
  });

  return {
    requestHeaders: e.requestHeaders
  };
}

// Callbacks addCustomHeaders function to modify the original headers
browser.webRequest.onBeforeSendHeaders.addListener(
  addCustomHeaders, {
    urls: ["<all_urls>"]
  },
  ["blocking", "requestHeaders"]
);

// Iterates the headers to confirm the existance of vulnerabilities
function verifyHeaders(e) {

  // Flags to detect missing XSS Protection and X-Frame-Options headers
  let xssProtectionFlag = 0;
  let xFrameOptionsFlag = 0;

  // Checks for redirection
  if (e.statusCode) {
    //if(e.statusCode == 302 || e.statusCode == 301) {
    let hostHeaderInjectionCheckPattern = "evilhosth3r0kU";
    let corsMisconfigurationCheckPattern = "evil.com";

    // Creating DOM elements to display the results
    corslist = document.getElementById('cors-list');
    hostlist = document.getElementById('host-header-list');
    clickjackinglist = document.getElementById('clickjacking-header-list');

    // Iterates all the response headers to detect the malicious reflected headers
    // to confirm the existance of vulnerability
    for (var header of e.responseHeaders) {
      // Checks for host header injection vulnerability
      if (header.name.toLowerCase() == "location" && header.value.match(hostHeaderInjectionCheckPattern)) {
        // console.log("hostHeaderInjection URL = " + e.url);
        let tmp = hostHeaderSet.size;
        hostHeaderSet.add(e.url);
        if (hostHeaderSet.size != tmp) {
          let pattern = $("#hostHeaderMatchPattern").val();
          $("#host-header-list").append(buildTag(e.url, pattern));
        }

      }
      
      // Checks for X-XSS-Protection missing header
      else if (header.name.toLowerCase() == "x-xss-protection") {
        xssProtectionFlag = 1;
      }

      // Checks for CORS Misconfiguration vulnerability
      else if (header.value.match(corsMisconfigurationCheckPattern)) {
        // console.log("CORS Misconfiguration URL = " + e.url);
        let tmp = corsSet.size;
        corsSet.add(e.url);
        if (corsSet.size != tmp) {
          let pattern = $("#corsMatchPattern").val();
          $("#cors-list").append(buildTag(e.url, pattern));
        }
      }

      // Checks for clickjacking vulnerability
      else if (header.name.toLowerCase() == "x-frame-options") {
        if (header.value.toLowerCase() == "sameorigin" || header.value.toLowerCase() == "allow-from" || header.value.toLowerCase() == "deny") {
          xFrameOptionsFlag = 1;
        }
      }
      // Checks for clickjacking vulnerability w.r.t CSP
      else if (header.name.toLowerCase() == "content-security-policy" || header.name.toLowerCase() == "x-content-security-policy") {
        if (header.value.indexOf("frame-src 'none'") !== -1 || header.value.indexOf("frame-src 'self'") !== -1 || header.value.indexOf("frame-ancestors 'none'") !== -1 || header.value.indexOf("frame-ancestors 'self'") !== -1) {
          xFrameOptionsFlag = 1;
        }
      }
    }
  }

  // Ignored as of now for testing other plugins
  // Enabling it will display all the URLs with missing X-XSS-Protection headers
  if (xssProtectionFlag == 0) {
    //console.log("X-XSS-Protection header missing : " + e.url);
  }

  // Appends clickjackign vulnerable URL to the result list
  if (xFrameOptionsFlag == 0) {
    // console.log("Found missing X-Frame-Options header in " + e.url);
    let tmp = clickjackingSet.size;
    clickjackingSet.add(e.url);
    if (clickjackingSet.size != tmp) {
      let pattern = $("#clickjackingMatchPattern").val();
      $("#clickjacking-header-list").append(buildTag(e.url, pattern));
    }
  }

  return {
    responseHeaders: e.responseHeaders
  };
}

// Callbacks verifyHeaders function to read the response headers
browser.webRequest.onHeadersReceived.addListener(
  verifyHeaders, {
    urls: ["<all_urls>"]
  },
  ["blocking", "responseHeaders"]
);

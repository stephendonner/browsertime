'use strict';

const merge = require('lodash.merge');
const pick = require('lodash.pick');
const isEmpty = require('lodash.isempty');
const get = require('lodash.get');
const forEach = require('lodash.foreach');
const dayjs = require('dayjs');
const version = require('../../../package').version;
const pathToFolder = require('../pathToFolder');
const util = require('../util.js');

function generateUniquePageId(baseId, existingIdMap) {
  let newId = baseId;
  while (existingIdMap.has(newId)) {
    newId = newId + '-1';
  }

  return newId;
}

function formatVisualProgress(visualProgress) {
  // Data coming in looks like
  // [{timestamp: 0,percent: 0},{timestamp: 560,percent: 26}]
  // Data going out looks like
  // {"0" : 0, "560" : 26}
  const visualProgressJSON = {};
  forEach(visualProgress, value => {
    visualProgressJSON[value.timestamp] = value.percent;
  });
  return visualProgressJSON;
}

module.exports = {
  addBrowser: function(har, name, version, comment) {
    merge(har.log, {
      browser: {
        name,
        version,
        comment
      }
    });

    if (!comment) {
      delete har.log.browser.comment;
    }

    return har;
  },

  addCreator: function(har, comment) {
    merge(har.log, {
      creator: {
        name: 'Browsertime',
        version: version,
        comment: comment
      }
    });

    if (!comment) {
      delete har.log.creator.comment;
    }

    return har;
  },

  getFullyLoaded: function(har) {
    const fullyLoaded = [];
    const entries = Array.from(har.log.entries);

    for (let page of har.log.pages) {
      const pageStartDateTime = new Date(page.startedDateTime).getTime();
      const pageId = page.id;
      const url = page._url;

      let pageEntries = Array.from(entries);
      pageEntries = Array.from(
        pageEntries.filter(entry => entry.pageref === pageId)
      );

      let pageEnd = 0;
      for (let entry of pageEntries) {
        let entryEnd =
          new Date(entry.startedDateTime).getTime() +
          entry.time -
          new Date(pageStartDateTime).getTime();
        if (entryEnd > pageEnd) {
          pageEnd = entryEnd;
        }
      }
      fullyLoaded.push({ url, fullyLoaded: pageEnd });
    }
    return fullyLoaded;
  },

  mergeHars: function(hars) {
    if (isEmpty(hars)) {
      return undefined;
    }
    if (hars.length === 1) {
      return hars[0];
    }
    let firstLog = hars[0].log;
    let combinedHar = {
      log: pick(firstLog, ['version', 'creator', 'browser', 'comment'])
    };
    let pagesById = new Map();
    let allEntries = [];

    hars.forEach(har => {
      let pages = har.log.pages;
      let entries = har.log.entries;
      pages.forEach(page => {
        let pageId = page.id;
        if (pagesById.has(pageId)) {
          const oldPageId = pageId;
          pageId = generateUniquePageId(oldPageId, pagesById);
          page.id = pageId;
          entries = entries.map(entry => {
            if (entry.pageref === oldPageId) {
              entry.pageref = pageId;
            }
            return entry;
          });
        }
        pagesById.set(pageId, page);
      });
      allEntries = allEntries.concat(entries);
    });

    combinedHar.log.pages = Array.from(pagesById.values());
    combinedHar.log.entries = allEntries;

    return combinedHar;
  },
  addMetaToHAR(index, harPage, url, options) {
    const _meta = (harPage._meta = {});
    _meta.connectivity = get(options, 'connectivity.profile', 'native');
    _meta.connectivity = get(options, 'connectivity.alias', _meta.connectivity);

    if (options.resultURL) {
      const base = options.resultURL.endsWith('/')
        ? options.resultURL
        : options.resultURL + '/';
      if (options.screenshot) {
        _meta.screenshot = `${base}${pathToFolder(
          url,
          options
        )}screenshots/${index + 1}.${options.screenshotParams.type}`;
      }
      if (options.video) {
        _meta.video = `${base}${pathToFolder(url, options)}video/${index +
          1}.mp4`;
      }
      if (options.chrome && options.chrome.timeline) {
        _meta.timeline = `${base}${pathToFolder(url, options)}trace-${index +
          1}.json.gz`;
      }
    }
  },

  addTimingsToHAR(harPage, visualMetricsData, timings, cpu) {
    const harPageTimings = harPage.pageTimings;

    const _visualMetrics = (harPage._visualMetrics = {});
    harPage._cpu = cpu;

    // We add the timings both as a hidden field and add
    // in pageTimings so we can easily show them in PerfCascade
    if (visualMetricsData) {
      const DO_NOT_INCLUDE_IN_HAR_TIMINGS = [
        'VisualReadiness',
        'SpeedIndex',
        'PerceptualSpeedIndex',
        'ContentfulSpeedIndex',
        'VisualProgress'
      ];

      for (let key of Object.keys(visualMetricsData)) {
        if (DO_NOT_INCLUDE_IN_HAR_TIMINGS.indexOf(key) === -1) {
          harPageTimings['_' + key.charAt(0).toLowerCase() + key.slice(1)] =
            visualMetricsData[key];
          _visualMetrics[key] = visualMetricsData[key];
        } else if (key !== 'VisualProgress') {
          _visualMetrics[key] = visualMetricsData[key];
        }
      }

      // Convert to sitespeedio's compare visual progress format.
      _visualMetrics.VisualProgress = formatVisualProgress(
        visualMetricsData.VisualProgress
      );
    } else if (timings && timings.firstPaint) {
      // only add first paint if we don't have visual metrics
      harPageTimings._firstPaint = timings.firstPaint;
    }
    if (timings && timings.pageTimings) {
      harPageTimings._domInteractiveTime =
        timings.pageTimings.domInteractiveTime;
      harPageTimings._domContentLoadedTime =
        timings.pageTimings.domContentLoadedTime;
    }
  },
  getEmptyHAR(url, browser) {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Browsertime',
          version: version,
          comment: ''
        },
        browser: {
          name: browser,
          version: ''
        },
        pages: [
          {
            startedDateTime: dayjs().format(),
            id: 'failing_page',
            title: url,
            pageTimings: {},
            comment: ''
          }
        ],
        entries: [],
        comment: ''
      }
    };
  }
};

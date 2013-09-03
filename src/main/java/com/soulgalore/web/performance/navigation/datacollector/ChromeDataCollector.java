package com.soulgalore.web.performance.navigation.datacollector;

import com.soulgalore.web.performance.navigation.timings.Timing;
import com.soulgalore.web.performance.navigation.timings.TimingMark;
import org.openqa.selenium.JavascriptExecutor;

import java.util.Map;

/**
 *
 */
public class ChromeDataCollector extends TimingDataCollector {
    @Override
    public void collectPageData(JavascriptExecutor js, Map<String, String> pageInfo) {
        super.collectPageData(js, pageInfo);

        Boolean wasFetchedViaSpdy = (Boolean) js
                .executeScript("return window.chrome.loadTimes().wasFetchedViaSpdy");
        pageInfo.put("wasFetchedViaSpdy", Boolean.toString(wasFetchedViaSpdy));
    }

    @Override
    public void collectMarks(JavascriptExecutor js, Timing results) {
        super.collectMarks(js, results);

        // Chrome timing is in s.ms, convert it to ms!!
        Double time = (Double) js.executeScript("return window.chrome.loadTimes().firstPaintTime");
        results.addMark(new TimingMark("firstPaintTime", (long) (time * 1000)));
    }
}

package com.shouxin.qa;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shouxin.qa.statistics.AnalysisService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AnalysisRequestJsonTests {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void deserializesPartialWorkbenchRequest() throws Exception {
        AnalysisService.AnalysisRequest request = mapper.readValue("""
                {"mode":"trend","primaryDimension":"status","page":1,"pageSize":10,
                 "dateRange":{"from":"2026-08-01","to":"2026-08-30","timeField":"createdAt"},
                 "filters":{"statuses":["published"],"keyword":"安全"}}
                """, AnalysisService.AnalysisRequest.class);

        assertThat(request.mode()).isEqualTo("trend");
        assertThat(request.pageSize()).isEqualTo(10);
        assertThat(request.dateRange().timeField()).isEqualTo("createdAt");
        assertThat(request.filters().statuses()).containsExactly("published");
        assertThat(request.filters().keyword()).isEqualTo("安全");
    }
}

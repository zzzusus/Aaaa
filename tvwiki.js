class TVWikiExtension {
    constructor() {
        // 티비위키는 주소가 수시로 차단되므로 도메인을 상수로 관리하거나 
        // MoA 설정을 통해 동적으로 주입받도록 구성하는 것이 좋습니다.
        this.baseUrl = "https://tvwiki.club"; 
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.baseUrl
        };
    }

    // 1. 메인 홈 / 인기 목록 파싱
    async getPopular(page) {
        // MoA 내장 HTTP 클라이언트를 사용해 페이지 요청
        const response = await http.get(`${this.baseUrl}/vod/page/${page}.html`, this.headers);
        const html = response.body;

        // HTML 요소 파싱 (Cheerio 등 MoA 내장 HTML 파서 규격 사용)
        const elements = dom.select(html, ".video-list-item"); 
        const list = [];

        for (const el of elements) {
            const title = dom.text(el, ".title");
            const link = dom.attr(el, "a", "href"); // 예: /vod/detail/12345.html
            const cover = dom.attr(el, "img", "src");

            list.push({
                name: title,
                link: link,
                imageUrl: cover
            });
        }

        return {
            list: list,
            hasNextPage: list.length > 0
        };
    }

    // 2. 작품 상세 정보 및 회차(에피소드) 목록 파싱
    async getDetail(url) {
        const response = await http.get(`${this.baseUrl}${url}`, this.headers);
        const html = response.body;

        const title = dom.text(html, "h1.entry-title");
        const description = dom.text(html, ".video-description");
        
        // 에피소드(회차) 리스트 추출
        const epiElements = dom.select(html, ".episode-list a");
        const chapters = [];

        for (let i = 0; i < epiElements.length; i++) {
            const el = epiElements[i];
            chapters.push({
                name: dom.text(el).trim(),
                url: dom.attr(el, "href") // 예: /vod/play/12345-1-1.html
            });
        }

        // 최신 에피소드가 위로 오도록 정렬 (선택 사항)
        return {
            name: title,
            description: description,
            episodes: chapters.reverse() 
        };
    }

    // 3. 비디오 플레이어 주소 및 m3u8 소스 추출
    async getVideoList(url) {
        const response = await http.get(`${this.baseUrl}${url}`, this.headers);
        const html = response.body;

        // 분석 포인트: 티비위키는 주로 iframe 내부에 비디오 소스를 숨기거나 
        // script 태그 내에 base64 또는 암호화된 JSON(예: 플레이어 설정 정보) 형태로 스트리밍 주소를 담아둡니다.
        
        let videoUrl = "";
        
        // 정규식을 사용해 script 내부의 m3u8 주소 매칭 추출 예시
        const m3u8Match = html.match(/(https?:\/\/[^"']+\.m3u8)/);
        
        if (m3u8Match) {
            videoUrl = m3u8Match[1];
        } else {
            // iframe 주소를 찾아서 한 번 더 진입해야 하는 경우
            const iframeSrc = dom.attr(html, "iframe#player", "src");
            if (iframeSrc) {
                const ifrResponse = await http.get(iframeSrc, { "Referer": this.baseUrl });
                const ifrHtml = ifrResponse.body;
                const innerMatch = ifrHtml.match(/(https?:\/\/[^"']+\.m3u8)/);
                if (innerMatch) videoUrl = innerMatch[1];
            }
        }

        // MoA가 비디오를 원활하게 스트리밍할 수 있도록 헤더와 함께 반환
        return [{
            url: videoUrl,
            quality: "Auto (HLS)",
            headers: {
                "User-Agent": this.headers["User-Agent"],
                "Referer": this.baseUrl, // 스트리밍 서버가 referer 체크를 할 경우 필수
                "Origin": this.baseUrl
            }
        }];
    }
}

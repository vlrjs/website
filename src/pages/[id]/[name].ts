import DOMParser from "dom-parser";
const parser = new DOMParser();

enum PageType {
    Match = 1,
    Thread = 2,
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

async function getMatch(matchId: string, matchName: string) {
    const url = `https://www.vlr.gg/${matchId}/${matchName}`;
    const x = await fetch(url);

    console.log(url)

    if (x.status === 404) return {
        code: 404,
        message: "Page not found"
    }

    const data = await x.text();
    const html = parser.parseFromString(data, "text/html");

    const divs = html.getElementsByTagName("div");
    const images = html.getElementsByTagName("img");
    const teams = html.getElementsByClassName("wf-title-med");
    const teamLink = html.getElementsByClassName("match-header-link");
    const note = html.getElementsByClassName("match-header-vs-note");
    const headerNote = html.getElementsByClassName("match-header-note");
    const times = html.getElementsByClassName("moment-tz-convert");
    const date = html.getElementsByClassName("match-header-date");
    const score = html.getElementsByClassName("js-spoiler");
    const vods = html.getElementsByTagName("a");

    let vod = 0;

    const series = html.getElementsByClassName("match-header-event-series")[0]?.textContent?.replace(/(\r\n|\n|\r|\t)/gm, '')?.trim()
    const link = html.getElementsByClassName("match-header-event")[0]?.attributes?.find(({ name }) => name === "href")?.value;

    const TBD = "TBD";
    const NotAvailable = "Not Available";
    const Unknown = "Unknown";

    const cache = {
        teams: [],
        notes: [],
        maps: [],
        vods: [],
        winner: TBD,
        patch: NotAvailable,
        time: "",
        status: NotAvailable,
        event: {
            name: NotAvailable,
            series: series || Unknown,
            image: Unknown,
            link: link ? 'https://vlr.gg' + link : Unknown,
        }
    };

    if (date.length > 0) {
        for (let i = 0; i < date.length; i++) {
            const text = date[i].textContent.replace(/(\r\n|\n|\r|\t)/gm, '').trim();
            if (text && (/(\d+\.)?(\d+\.)?(\*|\d+)$/g).test(text)) cache.patch = text.match(/(\d+\.)?(\d+\.)?(\*|\d+)$/g)[0];
        }
    }

    if (teams.length > 0) {
        for (let i = 0; i < teams.length; i++) {
            const text = teams[i].textContent.replace(/(\r\n|\n|\r)/gm, '').trim();
            if (!text) return;
            cache.teams[i] = {
                name: Unknown,
                link: Unknown,
            }
            cache.teams[i].name = text;
        }
    }

    if (note.length > 0) {
        for (let i = 0; i < note.length; i++) {
            const text = note[i].textContent.replace(/(\r\n|\n|\r)/gm, '').trim();
            if (!text) return;
            cache.notes.push(text);
            cache.notes = cache.notes.filter(onlyUnique);
        }
    }

    if (divs.length > 0) {
        for (var i = 0; i < divs.length; i++) {
            const div = divs[i];
            if (!div) return;
            const style = div.attributes.find(({ name }) => name === "style");
            if (style && style.value === "font-weight: 700;") cache.event.name = div.textContent.replace(/(\r\n|\n|\r|\t)/gm, '').trim();
        }
    }

    if (images.length > 0) {
        for (var i = 0; i < images.length; i++) {
            const img = images[i];
            if (!img) return;
            const style = img.attributes.find(({ name }) => name === "style");
            if (style && style.value === "height: 32px; width: 32px; margin-right: 6px;") cache.event.image = 'https' + img.attributes.find(({ name }) => name === "src").value;
        }
    }

    if (times.length > 0) {
        for (let i = 0; i < times.length; i++) {
            const text = times[i].textContent.replace(/(\r\n|\n|\r)/gm, '').trim();
            if (!text) return;
            if (i === 0) {
                cache.time += text;
            } else if (i === 1) {
                cache.time += ` - ${text}`;
            }
        }
    }

    if (score.length > 0) {
        for (let i = 0; i < score.length; i++) {
            if (i == 0) {
                const text = score[i].textContent.replace(/(\r\n|\n|\r|\t)/gm, '').trim();
                if (!text) return;
                const scores = text.split(":");
                if (parseInt(scores[0]) === 2) cache.winner = cache.teams[0];
                else cache.winner = cache.teams[1];
            }
        }
    }

    if (teamLink.length > 0 && teams.length > 0) {
        for (let i = 0; i < teamLink.length; i++) {
            if (cache.teams[i].name !== TBD) {
                if (!teamLink[i].attributes.find(({ name }) => name === "href")) return;
                cache.teams[i].link = 'https://vlr.gg' + teamLink[i].attributes.find(({ name }) => name === "href").value;
            }
        }
    }

    if (headerNote.length > 0) {
        for (let i = 0; i < headerNote.length; i++) {
            const text = headerNote[i].textContent.replace(/(\r\n|\n|\r)/gm, '').trim();
            if (!text) return;
            const raw = text.split(/((?:^|\W)(?:$|\W))/g)
            let pick = raw.filter(x => (x.includes('pick') || x.includes('remains'))).join(" ");
            pick = pick.match(/Pearl|Fracture|Split|Bind|Ascent|Haven|Icebox|Breeze/g);

            cache.maps = pick;
        }
    }  

    if (vods.length > 0) {
        for (let i = 0; i < vods.length; i++) {
            const style = vods[i].attributes.find(({ name }) => name === "style");

            // Full Match
            if (style && style.value === "height: 37px; line-height: 37px; padding: 0 20px; margin: 0 3px; margin-bottom: 6px; min-width: 108px; flex: 1;" || 
                style && style.value === "height: 37px; line-height: 37px; padding: 0 20px; margin: 0 3px; margin-bottom: 6px; flex: 1;") {
                cache.vods.push(vods[i].attributes.find(({ name }) => name === "href").value);
            } 
        }
    }

    if (cache.winner !== TBD) cache.status = "Complete";
    else if (cache.notes.includes("LIVE")) cache.status = "Live";
    else if (!cache.notes.includes("LIVE")) cache.status = "Upcoming";
    else cache.status = Unknown;

    // Check if any VODS are listed on vlr.gg
    const vodsExist = cache.vods.length === 0;

    if (vodsExist) cache.vods = NotAvailable as any;
    if (cache.event.name === TBD) cache.event.name = Unknown as any;
    if (cache.patch === TBD) cache.patch === Unknown as any;
    if (cache.maps.length < 1) cache.maps = Unknown as any;
    
    console.log(cache || 'a');

    return cache
}

async function getThread(id: string, name: string) {
    return {};
}

async function identifyPage(id: string, name: string) {
    const url = `https://www.vlr.gg/${id}/${name}`;
    const x = await fetch(url);
    const data = await x.text();
    const html = parser.parseFromString(data, "text/html");

    const thread = html.getElementsByClassName("thread-header-title") > 0;
    const match = html.getElementsByClassName("twf-title-med").length > 0;

    if (thread) return PageType.Thread;
    else if (match) return PageType.Match;
}

export async function get({ params, request }) {
    try {
        const pageType = await identifyPage(params.id, params.name);
        const results =  request.headers.get('match') ? await getMatch(params.id, params.name) : await getThread(params.id, params.name);
        if (!results) return new Response(JSON.stringify({ code: 404, message: 'No information found.' }), {
            status: 404,
            statusText: 'No information found.'
        });
        return new Response(JSON.stringify(results), {
            status: 200
        });
    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({
            code: 500,
            message: 'There was an error while fetching page information.'
        }), {
            status: 500,
            statusText: error.message
        });
    }
}
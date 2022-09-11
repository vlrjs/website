import DOMParser from "dom-parser";
import { unescape } from "html-escaping";

async function getMatches() {
    const parser = new DOMParser();

    const x = await fetch("https://www.vlr.gg/matches")
    if (x.status === 404) return {
        code: 404,
        message: "Page not found"
    }
    const data = await x.text()

    const html = parser.parseFromString(data, "text/html");
    let days = 0;
    let games: any = 0;
    let gamesArray = [];
    let links = []
    const dates = html.getElementsByClassName("wf-label");
    const matches = {
        dates: [],
        times: html.getElementsByClassName("match-item-time"),
        teams: html.getElementsByClassName("match-item-vs-team-name"),
        eta: html.getElementsByClassName("ml-eta"),
        events: html.getElementsByClassName("match-item-event"),
        eventSeries: html.getElementsByClassName("match-item-event-series"),
        status: html.getElementsByClassName("ml-status"),
        days: html.getElementsByClassName("match-item"),
        tags: html.getElementsByClassName("wf-tag"),
        cards: html.getElementsByClassName("wf-card"),
        currentScore: html.getElementsByClassName("match-item-vs-team-score"),
        twitchVod: html.getElementsByClassName("mod-twitch"),
        youtubeVod: html.getElementsByClassName("mod-yt"),
    }

    // Remove header card
    matches.cards.shift();

    for (let i = 0; i < matches.cards.length; i++) {
        const anchor = matches.cards[i].getElementsByTagName("a");
        for (let j = 0; j < anchor.length; j++) {
            links.push(anchor[j].attributes.find(({ name }) => name === "href").value);
        }
        gamesArray.push(anchor.length);
        games+=anchor.length;
    }

    // Games
    for (var i = 0; i < matches.days.length; i++) {
        const classNames = matches.days[i].attributes.find(({ name }) => name === "class").value;
        if (classNames.includes("mod-first")) {
            days++;
        }
    }

    // Tags
    for (var i = 0; i < matches.tags.length; i++) {
        const inner = matches.tags[i].innerHTML;
        matches.tags[i] = inner.replace(/(\r\n|\n|\r)/gm, '').trim();
    }

    // List of match days and games per day, all empty elements
    matches.days = Array.apply(null, Array(days)).map(function () { });
    games = Array.apply(null, new Array(games)).map(function () { });

    // Match Dates
    for (var i = 0; i < dates.length; i++) {
        const inner = dates[i].innerHTML;
        const g = gamesArray[i];

        for (var j = 0; j < g; j++) {
            matches.dates.push(inner.replace(/(\r\n|\n|\r)/gm, '').match(
                /([^\n <div class="wf\-label mod\-large">].*)(((1[0-2]|0?[1-9])\/(3[01]|[12][0-9]|0?[1-9])\/(?:[0-9]{2})?[0-9]{2})|((Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|Jun(e)?|Jul(y)?|Aug(ust)?|Sep(tember)?|Oct(ober)?|Nov(ember)?|Dec(ember)?)\s+\d{1,2},\s+\d{4}))[^\n ]*/g
            )[0].trim());
        }
    }

    // Match Times
    for (var i = 0; i < matches.times.length; i++) {
        const inner = matches.times[i].innerHTML;
        matches.times[i] = inner.replace(
            /(\r\n|\n|\r)/gm, ''
        ).trim();
        //console.log(matches.times[i])
    }

    // Match Teams
    for (var i = 0; i < matches.teams.length; i++) {
        const inner = matches.teams[i].textContent;
        matches.teams[i] = inner.replace(
            /(\r\n|\n|\r)/gm, ''
        ).trim();
        //console.log(matches.teams[i])
    }

    // Match ETA
    for (var i = 0; i < matches.eta.length; i++) {
        const inner = matches.eta[i].innerHTML;
        matches.eta[i] = inner.replace(
            /(\r\n|\n|\r)/gm, ''
        ).trim();
        //console.log(matches.eta[i])
    }

    // Match Status
    for (var i = 0; i < matches.status.length; i++) {
        const inner = matches.status[i].innerHTML;
        matches.status[i] = inner.replace(
            /(\r\n|\n|\r)/gm, ''
        ).trim();
        //console.log(matches.eta[i])
    }

    // Event of Match
    for (var i = 0; i < matches.events.length; i++) {
        const inner = matches.events[i].textContent;
        matches.events[i] = inner.replace(
            /(\r\n|\n|\r)/gm, ''
        ).trim();
        //console.log(matches.tourtaments[i])
    }

    // Event Series of Match
    for (var i = 0; i < matches.eventSeries.length; i++) {
        const inner = matches.eventSeries[i].textContent;
        matches.eventSeries[i] = unescape(inner.replace(
            /(\r\n|\n|\r)/gm, ''
        ).trim());
        //console.log(matches.tourtaments[i])
    }

    // Join Teams Into One Group
    matches.teams = matches.teams.reduce(
        function (accumulator, currentValue, currentIndex, array) {
            if (currentIndex % 2 === 0)
                accumulator.push(array.slice(currentIndex, currentIndex + 2));
            return accumulator;
        }, []).map(p => [p[0], p[1]]);

    // Get LIVE Score of Match
    for (var i = 0; i < matches.currentScore.length; i++) {
        const score = parseInt(matches.currentScore[i].textContent);
        if (!isNaN(score)) matches.currentScore[i] = score;
        else matches.currentScore[i] = null;
    }

    // Join Scores Into One Group
    matches.currentScore = matches.currentScore.reduce(
        function (accumulator, currentValue, currentIndex, array) {
            if (currentIndex % 2 === 0)
                accumulator.push(array.slice(currentIndex, currentIndex + 2));
            return accumulator;
        }, []).map(p => [p[0], p[1]]);

    const results = games.map((_, idx) => {
        const time = matches.times[idx];
        const teams = matches.teams[idx];
        const score = matches.currentScore[idx];
        const eta = matches.eta[idx];
        const event = matches.events[idx];
        const status = matches.status[idx];
        const eventSeries = matches.eventSeries[idx];
        const tag = matches.tags[idx];
        const date = matches.dates[idx];
        const data: any = {
            date,
            teams,
            time,
            event: event.replace(eventSeries, '').replace(/(\r\n|\n|\r)/gm, '').trim(),
            status,
            series: eventSeries.replace('&ndash;', '–'),
            link: `https://vlr.gg${links[idx]}`
        };
        if (status !== "LIVE") data.eta = eta, data.live = 0;
        if (tag) data.live = 1, data.score = score
        return data
    })
    return results;
}

export async function get() {
    try {
        const matches = await getMatches();
        return new Response(JSON.stringify(matches), {
            status: 200
        });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({
            code: 500,
            message: 'There was an error while fetching the match information.'
        }), {
            status: 500,
            statusText: error.message
        });
    }
}
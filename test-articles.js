
const { getBestTechArticle } = require("./lib/articles");

async function test() {
    console.log("Testing 'React.js'...");
    const res1 = await getBestTechArticle("React.js");
    console.log("Result 1:", res1);

    console.log("Testing 'React'...");
    const res2 = await getBestTechArticle("React");
    console.log("Result 2:", res2);
}

test();

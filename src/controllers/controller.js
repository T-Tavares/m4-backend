/* 
    Useful links

    Repo where I finally understood a bit on what was going on
    * https://github.com/google/generative-ai-js/blob/main/samples/node/simple-text-and-images.js
    https://github.com/google/generative-ai-js

    Vlad and Chelsea Mission 2 Repo
    https://github.com/ntLeo/Mission-2/blob/main/src/components/ai-with-image.tsx

*/

// ---------------------------------------------------------------- //
// ---------------------- IMPORTS AND SETUP ----------------------- //
// ---------------------------------------------------------------- //
const fetchTurnersCarsList = require('./mongoDBControllers.js');

// .ENV SETUP
require('dotenv').config();

// IMPORTS
const fs = require('fs');
const path = require('path');
const {GoogleGenerativeAI} = require('@google/generative-ai');

// AI CLIENT
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// --------------------------- SETTINGS --------------------------- //

/* 
    The images are briefly saved on the server side then are analysed and finally deleted.
    That's the IMAGES_PATH location 
    The prompt is how the AI will handler the images, what is being asked for it to do.

    Here I am handling images that are not a car on the prompt itself. And also limiting the 
    format i want my response so I can conscistently work with it on the frontend.
*/

const IMAGES_PATH = '../backend/tempImages/';

/* 
    The ai prompt will always fetch the most recent turnersCars database To compare with 
    the results of the image analisis.
*/

async function aiPrompt() {
    const turnersDatabase = await fetchTurnersCarsList();
    const promptString = `I have two tasks for you. 

    The first one, I need you to identify this car brand and model and return it as a json file with the exact keys: model, brand, similar_cars. 
    The second task is about how you're going to fill the similar_cars values. I need you to cross references with my database and find what are the similar cars to the one in the image that I have on my database. The similar_cars should have these exact keys: model, year, price.
    
    If the image is not a car return {error: "The image is not of a car. Please pick a different image."}
    If on my database there aren't any similar car to the one on the image, return {noMatches: "Currently we don't have any car that matches your requirements."}
    
    My database below:

    ${turnersDatabase.toString()}

    IMPORTANT: the similar_cars values MUST be only of cars you can find on my database. 
    `;

    return promptString;
}

// ---------------------------------------------------------------- //
// --------------------- SAVE IMAGE TO SERVER --------------------- //
// ---------------------------------------------------------------- //

function saveImageToServer(file) {
    /* 
        Because fs is Async this function had to be Promisified So I could 
        retrieve the fileName value.

        fileName is how the AI Client will pick the image to analyse on the server 
    */
    return new Promise((resolve, reject) => {
        fs.readFile(file.path, (err, data) => {
            if (err) {
                console.error('Error reading uploaded file:', err);
                reject('Error reading uploaded file.');
                return;
            }

            // Save the file with a unique name
            const fileName = `image_${Date.now()}.jpeg`;
            try {
                fs.writeFileSync('tempImages/' + fileName, data);
                console.log('Image saved as:', fileName);
                resolve(fileName);
            } catch (writeErr) {
                console.error('Error while saving image file on server.\n', writeErr);
                reject('Error saving file');
            }
        });
    });
}

// ---------------------------------------------------------------- //
// ----------------------- SERVER CLEAN UP ------------------------ //
// ---------------------------------------------------------------- //

const cleanUpTempFiles = () => {
    // DELETE MULTER IMAGES FILES
    fs.readdir(IMAGES_PATH, (err, files) => {
        if (err) return console.error('Error reading folder:', err);

        // DELETE MULTER DOWNLOADED IMAGES
        files.forEach(file => {
            // Construct the full path of the file
            const filePath = path.join(IMAGES_PATH, file);
            // Delete the file
            fs.unlink(filePath, err => {
                if (err) return console.error('Error deleting file:', err);
                console.log('File deleted:', filePath);
            });
        });
    });

    console.log('Clean up successful!');
};

// ---------------------------------------------------------------- //
// ---------------------- IMAGE AI ANALYSIS ----------------------- //
// ---------------------------------------------------------------- //
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString('base64'),
            mimeType,
        },
    };
}
async function aiGenerativeAnalysis(imageName) {
    const model = genAI.getGenerativeModel({model: 'gemini-pro-vision'});

    const image = fileToGenerativePart(IMAGES_PATH + imageName, 'image/jpeg');

    const result = await model.generateContent([await aiPrompt(), image]);

    // Clear string response and convert to JSON
    const response = result.response;
    const text = response.text().replaceAll('```', '').replace('json', '');

    const jsonRes = JSON.parse(text);

    return jsonRes;
}

// ---------------------------------------------------------------- //
// ----------------------- ANALYSE CAR API ------------------------ //
// ---------------------------------------------------------------- //

async function analyseCarImage(req, res) {
    const file = req.file;
    if (!file) return res.status(400).send('No file uploaded.');

    const fileName = await saveImageToServer(file);
    const analysisResult = await aiGenerativeAnalysis(fileName);

    cleanUpTempFiles();

    res.status(200).send(await analysisResult);
}

module.exports = analyseCarImage;

/* 
    AI ERROR NOTE

    There's a intermitent error that happen usually after several fast attempts on running the ai analisis 
    For some reason it raises flags checking the intentions of the question. I believe it's a bug on Google AI's
    A few other people encountered the same problem but there's only expeculations that it's due to google censorship algorithm.
    
    I'll drop some Git Issues about it here: 
    
    https://github.com/google/generative-ai-docs/issues/212
    https://github.com/google/generative-ai-python/issues/126

    There aren't yet, any viable solutions. Apart from attempt to set the propability with 'BLOCK NONE'. But the internal AI module,
    which pleb like us have no access to, still will pass flags and restrictions whenever it feels like it.


    ! For reference here's the error log ::.
    Thrown on the aiGenerativeAnalysis function 

        /Users/thiagotavares/Desktop/Tavares/Studies/Mission Ready/Level 5/Missions/Mission 4/backend/node_modules/@google/generative-ai/dist/index.js:267
            throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
                            ^

        GoogleGenerativeAIResponseError: [GoogleGenerativeAI Error]: Candidate was blocked due to RECITATION
            at response.text (/Users/thiagotavares/Desktop/Tavares/Studies/Mission Ready/Level 5/Missions/Mission 4/backend/node_modules/@google/generative-ai/dist/index.js:267:23)
            at aiGenerativeAnalysis (/Users/thiagotavares/Desktop/Tavares/Studies/Mission Ready/Level 5/Missions/Mission 4/backend/src/controllers/controller.js:144:27)
            at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
            at async analyseCarImage (/Users/thiagotavares/Desktop/Tavares/Studies/Mission Ready/Level 5/Missions/Mission 4/backend/src/controllers/controller.js:160:28) {
        response: {
            candidates: [ { finishReason: 'RECITATION', index: 0 } ],
            promptFeedback: {
            safetyRatings: [
                {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                probability: 'NEGLIGIBLE'
                },
                {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                probability: 'NEGLIGIBLE'
                },
                {
                category: 'HARM_CATEGORY_HARASSMENT',
                probability: 'NEGLIGIBLE'
                },
                {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                probability: 'NEGLIGIBLE'
                }
            ]
            },
            text: [Function (anonymous)]
        }
        }

        Node.js v21.7.1
        [nodemon] app crashed - waiting for file changes before starting...

*/

'use strict';

const BootBot = require('bootbot');

const request = require('request');
const schedule = require('node-schedule');
const dateFormat = require('dateformat');

// Bot framework
const bot = new BootBot({
    accessToken: process.env.PAGE_ACCESS_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    appSecret: process.env.APP_SECRET
});

const API_MASTER = process.env.API_MASTER + "/v1";

bot.hear(['hello', 'hi', 'hey', 'geia', 'γεια'], (payload, chat) => {
    chat.say('Hello, human!');
});

bot.hear(['register', 'εγγραφή'], (payload, chat) => {
    setupUser(payload, chat);
});

bot.on('postback:REGISTER_AGAIN_PAYLOAD', (payload, chat) => {
    setupUser(payload, chat);
});

bot.on('postback:FOOD_TODAY_PAYLOAD', (payload, chat) => {
    const now = new Date();
    request(`${API_MASTER}/food/${dateFormat(now, "dd-mm-yyyy")}`, {json: true}, (err, res, body) => {
        if (err) {
            return console.log(err);
        }

        if (now.getHours() >= 16) {
            chat.say(`Σήμερα το απόγευμα το μενού έχει ${body.food.dinner}! Καλή όρεξη <3`);
            return;
        }
        chat.say('Σήμερα το μενού έχει:').then(() => {
            chat.say(`Για μεσημέρι ${body.food.lunch} και`).then(() => {
                chat.say(`για απόγευμα ${body.food.dinner}! Καλή όρεξη <3`);
            });
        });

    });
});

bot.on('postback:FOOD_TOMORROW_PAYLOAD', (payload, chat) => {

    // Set currentDate PLUS one day
    const now = new Date();
    now.setDate(now.getDate() + 1);
    request(`${API_MASTER}/food/${dateFormat(now, "dd-mm-yyyy")}`, {json: true}, (err, res, body) => {
        if (err) {
            return console.log(err);
        }

        //TODO: Remove .then() - Trasform it in one line code.
        chat.say('Αύριο το μενού έχει:').then(() => {
            chat.say(`Για μεσημέρι ${body.food.lunch} και`).then(() => {
                chat.say(`για απόγευμα ${body.food.dinner}! Καλή όρεξη <3`);
            });
        });

    });
});

bot.on('postback:CONTACT_INFO_PAYLOAD', (payload, chat) => {
    chat.say('Μπορείς να επικοινωνήσεις με τον διαχειριστή μου στο email icsd14174@icsd.aegean.gr!')
        .then(() => {
            chat.say({
                attachment: 'image',
                url: 'https://res.cloudinary.com/savvakiscloud01/image/upload/v1531060442/letifood/static/contact_image.gif'
            })
        });

});

bot.on('postback:BORED_PAYLOAD', (payload, chat) => {
    request(`https://api.giphy.com/v1/gifs/random?api_key=${process.env.GIPHY_API_KEY}&tag=&rating=G`, {json: true}, (err, res, body) => {
        if (err) {
            return console.log(err);
        }
        chat.say({
            attachment: 'image',
            url: body.data.images.fixed_width.url
        })
    });

});

bot.setGetStartedButton((payload, chat) => {
    setupUser(payload, chat);
});

bot.setGreetingText("Είμαι εδώ για να σε ενημέρωνω για το φαγητό της λέσχης σου, μπορεί όμως κάποιες φορές να σου λέω και κάνενα ανέκδοτο");
bot.setPersistentMenu([
    {
        title: 'Φαγητό Σήμερα',
        type: 'postback',
        payload: 'FOOD_TODAY_PAYLOAD'
    },
    {
        title: 'Φαγητό Αύριο',
        type: 'postback',
        payload: 'FOOD_TOMORROW_PAYLOAD'
    },
    {
        title: 'Περισσότερα',
        type: 'nested',
        call_to_actions: [
            {
                title: 'Βαριέμαι',
                type: 'postback',
                payload: 'BORED_PAYLOAD'
            }, {
                title: 'Επανάληψη εγγραφής',
                type: 'postback',
                payload: 'REGISTER_AGAIN_PAYLOAD'
            },
            {
                title: 'Github',
                type: 'web_url',
                url: 'https://google.com'
            },
            {
                title: 'Επικοινωνία',
                type: 'postback',
                payload: 'CONTACT_INFO_PAYLOAD'
            }
        ]
    }
], false);

const setupUser = (payload, chat) => {

    // Start from here
    chat.getUserProfile().then((user) => {
        chat.conversation((convo) => {
            convo.set('userID', user.id);

            // Check if user exists
            request(`${API_MASTER}/user/${user.id}`, {json: true}, (err, res, body) => {
                if (err) {
                    return;
                }

                if (body["message"]) {
                    convo.say(`Hey ${user.first_name}, θέλεις να αλλάξεις μήπως την ενημέρωση που δέχεσαι κάθε μέρα;`);
                    askFoodConfirmAlert(convo);
                    return;
                }

                convo.say(`Hey ${user.first_name}, χαίρομαι που μου έστειλες!`);
                askFoodAlert(convo);
            });

        });
    });

    const askFoodAlert = (convo) => {
        const question = {
            text: `Θέλεις να σε ενημερώνω κάθε μέρα για το φαγητό της λέσχης;`,
            buttons: [
                {type: 'postback', title: 'Ναι', payload: 'ACCEPT_ALERT_PAYLOAD'},
                {type: 'postback', title: 'Όχι', payload: 'DECLINED_ALERT_PAYLOAD'}
            ]
        };

        const answer = (payload, convo) => {
            convo.say(`Χμμμ... δεν σε κατάλαβα`).then(() => {
                askFoodAlert(convo);
            });
        };

        const callbacks = [
            {
                event: 'postback:ACCEPT_ALERT_PAYLOAD',
                callback: (payload, convo) => {
                    convo.set('foodalert', true);
                    convo.say(`Τέλεια!`).then(() => sendSummary(convo));
                }
            },
            {
                event: 'postback:DECLINED_ALERT_PAYLOAD',
                callback: (payload, convo) => {
                    convo.set('foodalert', false);
                    convo.say(`Τέλεια!`).then(() => sendSummary(convo));
                }
            }
        ];

        const options = {
            typing: true // Send a typing indicator before asking the question
        };

        convo.ask(question, answer, callbacks, options);
    };

    const askFoodConfirmAlert = (convo) => {
        const question = {
            text: `Θέλεις να σε ενημερώνω κάθε μέρα για το φαγητό της λέσχης;`,
            buttons: [
                {type: 'postback', title: 'Ναι', payload: 'ACCEPT_ALERT_PAYLOAD'},
                {type: 'postback', title: 'Όχι', payload: 'DECLINED_ALERT_PAYLOAD'}
            ]
        };

        const answer = (payload, convo) => {
            convo.say(`Χμμμ... δεν σε κατάλαβα`).then(() => {
                askFoodConfirmAlert(convo);
            });
        };

        const callbacks = [
            {
                event: 'postback:ACCEPT_ALERT_PAYLOAD',
                callback: (payload, convo) => {
                    convo.set('foodalert', true);
                    convo.say(`Τέλεια!`).then(() => sendConfirmSummary(convo));
                }
            },
            {
                event: 'postback:DECLINED_ALERT_PAYLOAD',
                callback: (payload, convo) => {
                    convo.set('foodalert', false);
                    convo.say(`Τέλεια!`).then(() => sendConfirmSummary(convo));
                }
            }
        ];

        const options = {
            typing: true // Send a typing indicator before asking the question
        };

        convo.ask(question, answer, callbacks, options);
    };

    // Create User
    const sendSummary = (convo) => {
        request({
            url: `${API_MASTER}/user/${convo.get('userID')}`,
            method: "POST",
            json: {"alert": convo.get('foodalert'), "bot": "fb"}
        }, (err, res, body) => {
            if (err || res.statusCode !== 201) {
                convo.say('Θέλω να σε ενημέρωσω πως η εγγραφή σου δεν ολοκληρώθηκε ξαναπροσπάθησε αργότερα ή επικοινώνησε με τον διαχειριστή μου');
                return;
            }
            convo.say('Θέλω να σε ενημέρωσω πως η εγγραφή σου ολοκληρώθηκε με επιτυχία!');
        });
        convo.say('Οτιδήποτε άλλο θέλεις επέλεξε από το μενού!');
        convo.end();
    };

    // Update User
    const sendConfirmSummary = (convo) => {
        request({
            url: `${API_MASTER}/user/${convo.get('userID')}`,
            method: "PUT",
            json: {"alert": convo.get('foodalert'), "bot": "fb"}
        }, (err, res, body) => {
            if (err || res.statusCode !== 200) {
                convo.say('Θέλω να σε ενημέρωσω πως η αλλαγή σου δεν ολοκληρώθηκε ξαναπροσπάθησε αργότερα ή επικοινώνησε με τον διαχειριστή μου');
                return;
            }
            convo.say('Θέλω να σε ενημέρωσω πως η αλλαγή σου ολοκληρώθηκε με επιτυχία!');
        });
        convo.say('Οτιδήποτε άλλο θέλεις επέλεξε από το μενού!');
        convo.end();
    };
};

schedule.scheduleJob({hour: 11, minute: 30}, function () {
    request(`${API_MASTER}/users/fb`, {json: true}, (err, res, body) => {
        if (err) {
            return console.log(err);
        }

        const users = body.users;

        const now = new Date();
        request(`${API_MASTER}/food/${dateFormat(now, "dd-mm-yyyy")}`, {json: true}, (err, res, body) => {
            if (err) {
                return console.log(err);
            }

            const options = {
                notificationType: 'REGULAR'
            };

            const messagesToSend = [
                'Hey! Σήμερα το μενού έχει:',
                `Για μεσημέρι ${body.food.lunch} και`,
                `για απόγευμα ${body.food.dinner}! Καλή όρεξη <3`
            ];

            for (let i in users) {
                const fid = users[i].fid;

                bot.say(fid, messagesToSend, options);
            }
        });

    });
});


bot.start(process.env.PORT || 3000);
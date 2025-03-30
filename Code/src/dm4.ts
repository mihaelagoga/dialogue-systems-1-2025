import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import {KEY,NLU_KEY } from "./azure";
import { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();


const azureCredentials = {
  endpoint: "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://language-resource-23456.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
  key: NLU_KEY,
  deploymentName: "appointment",
  projectName: "appointment",
};

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials,
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

const famousPerson: { [index: string]: string } = {
  "jerry springer": "Jerry Springer was an American TV host, most famous for his controversial talk show.",
  "william gibson": "William Gibson is an American-Canadian science-fiction writer, known for pioneering the cyberpunk genre and coining the term 'cyberspace'.",
  "ray bradbury": "Ray Bradbury was an American author known for 'Fahrenheit 451' and various fantasy and science fiction works.",
  "terry pratchett": "Sir Terry Pratchett was an English author, humorist, and satirist, best known for his Discworld series.",
  "dr.seuss": "Dr. Seuss, Theodor Seuss Geisel, was an American children's author and cartoonist, famous for books like 'The Cat in the Hat'.",
  "robert smith": "Robert Smith is an English singer, songwriter, and musician, best known as the lead vocalist of the rock band The Cure.",
  "jim morrison": "Jim Morrison was an American singer, poet, and lead vocalist of the rock band The Doors.",
  "meryl streep": "Meryl Streep is a renowned American actress, widely regarded as one of the greatest actresses of her generation.",
  "malcolm x": "Malcolm X was an African-American Muslim minister and human rights activist, a prominent figure during the civil rights movement.", // Corrected spelling
  "morgan freeman": "Morgan Freeman is an acclaimed American actor, producer, and narrator, known for his distinctive deep voice.",
 };

// --- Helper Functions ---
function getEntityValue(nluResult: any, entityCategory: string): string | null {
  if (!nluResult?.entities) return null;
  const entity = nluResult.entities.find((e: any) => e.category === entityCategory);
  return entity?.text?.trim() ? entity.text.trim() : null;
}

function hasEntity(nluResult: any, entityCategory: string): boolean {
    return !!getEntityValue(nluResult, entityCategory);
}


const dmMachine = setup({ 
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    "spst.speak": ({ context }: { context: DMContext }, params: { utterance: string }) => { 
      console.log("SPEAK:", params.utterance);
      context.spstRef.send({ type: "SPEAK", value: { utterance: params.utterance } });
    },
    "spst.listen": ({ context }: { context: DMContext }) => {
       console.log("LISTEN");
       context.spstRef.send({ type: "LISTEN", value: { nlu: true } });
    },
    "clearContext": assign({
      lastResult: null, nluResult: null, meetingPartnerName: null,
      meetingDay: null, meetingTime: null, isWholeDay: false,
      famousPersonName: null
    }),
    "assignResults": assign(({ event }: { event: DMEvents }) => { 
      if ('value' in event && 'nluValue' in event) {
        console.log('RECOGNISED:', event.value);
        console.log('NLU RESULT:', JSON.stringify(event.nluValue, null, 2));
        return { lastResult: event.value, nluResult: event.nluValue };
      }
      return {};
    }),
    "assignPersonName": assign({
        meetingPartnerName: ({ context }: { context: DMContext }) => { 
            const name = getEntityValue(context.nluResult, "meetingPartnerName");
            console.log(`ACTION assignPersonName: Extracted '${name}' from NLU:`, JSON.stringify(context.nluResult));
            return name;
        }
    }),
    "assignDay": assign({
        meetingDay: ({ context }: { context: DMContext }) => { 
            const day = getEntityValue(context.nluResult, "meetingDay");
            console.log(`ACTION assignDay: Extracted '${day}' from NLU:`, JSON.stringify(context.nluResult));
            return day;
        }
    }),
    "assignTime": assign({
        meetingTime: ({ context }: { context: DMContext }) => { 
            const time = getEntityValue(context.nluResult, "meetingTime");
            console.log(`ACTION assignTime: Extracted '${time}' from NLU:`, JSON.stringify(context.nluResult));
            return time;
        }
    }),
    "assignWholeDayIfYes": assign({
        isWholeDay: ({ context }: { context: DMContext }) => { 
            const nluResult = context.nluResult;
            const isYes = nluResult?.topIntent === 'decisionIntent' && hasEntity(nluResult, 'yes');
             console.log(`ACTION assignWholeDayIfYes: Setting isWholeDay to ${isYes}`);
            return isYes;
        }
    }),
     "assignFamousPerson": assign({
        famousPersonName: ({ context }: { context: DMContext }) => { 
            const name = getEntityValue(context.nluResult, "famousPerson");
            console.log(`ACTION assignFamousPerson: Extracted '${name}' from NLU:`, JSON.stringify(context.nluResult));
            return name;
        }
     }),
  },
  guards: {
 
    "isCreateMeetingIntent": ({ context }: { context: DMContext }) => context.nluResult?.topIntent === "create a meeting",
    "isWhoIsIntent": ({ context }: { context: DMContext }) => context.nluResult?.topIntent === "who is X",
    "isDecisionIntent": ({ context }: { context: DMContext }) => context.nluResult?.topIntent === "decisionIntent",
    "hasPersonEntity": ({ context }: { context: DMContext }) => {
       const has = hasEntity(context.nluResult, "meetingPartnerName");
       console.log("GUARD hasPersonEntity check:", has);
       return has;
      },
    "hasDayEntity": ({ context }: { context: DMContext }) => {
       const has = hasEntity(context.nluResult, "meetingDay");
       console.log("GUARD hasDayEntity check:", has);
       return has;
     },
    "hasTimeEntity": ({ context }: { context: DMContext }) => {
        const has = hasEntity(context.nluResult, "meetingTime");
        console.log("GUARD hasTimeEntity check:", has);
        return has;
    },
    "hasFamousPersonEntity": ({ context }: { context: DMContext }) => {
        const has = hasEntity(context.nluResult, "famousPerson");
        console.log("GUARD hasFamousPersonEntity check:", has);
        return has;
    },
    "isYesDecision": ({ context }: { context: DMContext }) => {
      const isYes = context.nluResult?.topIntent === 'decisionIntent' && hasEntity(context.nluResult, 'yes');
      console.log("GUARD isYesDecision check:", isYes);
      return isYes;
    },
    "isNoDecision": ({ context }: { context: DMContext }) => {
      const isNo = context.nluResult?.topIntent === 'decisionIntent' && hasEntity(context.nluResult, 'no');
       console.log("GUARD isNoDecision check:", isNo);
      return isNo;
    },
    "isKnownFamousPerson": ({ context }: { context: DMContext }) => {
      const personEntity = getEntityValue(context.nluResult, "famousPerson");
      const isKnown = !!personEntity && personEntity.toLowerCase() in famousPerson;
      console.log(`GUARD isKnownFamousPerson check: name='${personEntity}', isKnown=${isKnown}`);
      return isKnown;
    },
  }

}).createMachine({ 
  context: ({ spawn }): DMContext => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    nluResult: null,
    meetingPartnerName: null,
    meetingDay: null,
    meetingTime: null,
    isWholeDay: false,
    famousPersonName: null,
  }),
  id: "DM",
  initial: "Prepare",
  on: {
    RECOGNISED: { actions: "assignResults" },
  },
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Greeting" },
    },
    Greeting: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "Hello! What can I help you with today? Set up an appointment or ask about a famous person?" } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        Listen: {
          entry: { type: "spst.listen" },
          on: {
              ASR_NOINPUT: "NoInput",
              LISTEN_COMPLETE: "ProcessIntent"
           }
        },
        ProcessIntent: {
            always: [
                 { target: "#DM.CelebrityInfo", guard: "isWhoIsIntent", actions: "assignFamousPerson" },
                 { target: "#DM.CreateMeeting", guard: "isCreateMeetingIntent" },
                 { target: "NoInput" }
            ]
        },
        NoInput: {
          entry: { type: "spst.speak", params: { utterance: "I didn't quite catch that. Could you please repeat?" } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
      },
    },
    CreateMeeting: {
      id: "CreateMeeting",
      initial: "AskWho",
      states: {
        AskWho: {
          entry: { type: "spst.speak", params: { utterance: "Okay, let's schedule a meeting. Who are you meeting with?" } },
          on: { SPEAK_COMPLETE: "GetWho" },
        },
        GetWho: {
          entry: { type: "spst.listen" },
          on: {
            ASR_NOINPUT: "NoInputWho",
            LISTEN_COMPLETE: "ProcessWhoResult"
          },
        },
        ProcessWhoResult: {
           entry: "assignPersonName",
           always: [
           
             { target: "AskDay", guard: ({ context }: { context: DMContext }) => !!context.meetingPartnerName },
             { target: "NoInputWho" }
           ]
         },
        NoInputWho: {
          entry: { type: "spst.speak", params: { utterance: "I'm sorry, I didn't get the name. Who are you meeting with?" } },
          on: { SPEAK_COMPLETE: "GetWho" },
        },
        AskDay: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `Got it, meeting with ${context.meetingPartnerName || 'them'}. On which day?` }) },
          on: { SPEAK_COMPLETE: "GetDay" },
        },
        GetDay: {
          entry: { type: "spst.listen" },
          on: { ASR_NOINPUT: "NoInputDay", LISTEN_COMPLETE: "ProcessDayResult" },
        },
         ProcessDayResult: {
            always: [
              
                { target: "AskWholeDay", guard: "hasDayEntity", actions: "assignDay"},
                { target: "NoInputDay" }
            ]
         },
        NoInputDay: {
          entry: { type: "spst.speak", params: { utterance: "Sorry, which day was that?" } },
          on: { SPEAK_COMPLETE: "GetDay" },
        },
        AskWholeDay: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `Okay, ${context.meetingDay}. Will this meeting take the whole day? Yes or no?` }) },
          on: { SPEAK_COMPLETE: "GetWholeDay" },
        },
        GetWholeDay: {
          entry: { type: "spst.listen" },
          on: { ASR_NOINPUT: "NoInputWholeDay", LISTEN_COMPLETE: "ProcessWholeDayResult" },
        },
        ProcessWholeDayResult: {
            always: [
                { target: "ConfirmAppointment", guard: "isYesDecision", actions: "assignWholeDayIfYes" },
                { target: "AskTime", guard: "isNoDecision" },
                { target: "NoInputWholeDay" }
            ]
        },
        NoInputWholeDay: {
          entry: { type: "spst.speak", params: { utterance: "Sorry, I need a 'yes' or 'no'. Will it take the whole day?" } },
          on: { SPEAK_COMPLETE: "GetWholeDay" },
        },
        AskTime: {
          entry: { type: "spst.speak", params: { utterance: "Okay, what time is the meeting?" } },
          on: { SPEAK_COMPLETE: "GetTime" },
        },
        GetTime: {
          entry: { type: "spst.listen" },
          on: { ASR_NOINPUT: "NoInputTime", LISTEN_COMPLETE: "ProcessTimeResult"},
        },
        ProcessTimeResult: {
            always: [
                { target: "ConfirmAppointment", guard: "hasTimeEntity", actions: "assignTime"},
                { target: "NoInputTime" }
            ]
        },
        NoInputTime: {
          entry: { type: "spst.speak", params: { utterance: "Sorry, what time did you say?" } },
          on: { SPEAK_COMPLETE: "GetTime" },
        },
        ConfirmAppointment: {
          entry: { type: "spst.speak", params: ({ context }) => {
              const timeInfo = context.isWholeDay ? "for the whole day" : (context.meetingTime ? `at ${context.meetingTime}` : '(time not specified)');
              const partner = context.meetingPartnerName || 'them';
              const day = context.meetingDay || '(day not specified)';
              return { utterance: `Would you like me to create an appointment with ${partner} on ${day} ${timeInfo}? Yes or no?` };
            }
          },
          on: { SPEAK_COMPLETE: "GetConfirmation" },
        },
        GetConfirmation: {
          entry: { type: "spst.listen" },
          on: { ASR_NOINPUT: "NoInputConfirmation", LISTEN_COMPLETE: "ProcessConfirmationResult"},
        },
        ProcessConfirmationResult: {
            always: [
                { target: "AppointmentCreated", guard: "isYesDecision" },
                { target: "AppointmentCanceled", guard: "isNoDecision" },
                { target: "NoInputConfirmation" }
            ]
        },
        NoInputConfirmation: {
          entry: { type: "spst.speak", params: { utterance: "Sorry, please confirm with 'yes' or 'no'." } },
          on: { SPEAK_COMPLETE: "GetConfirmation" },
        },
        AppointmentCreated: {
          entry: { type: "spst.speak", params: { utterance: "Great! Your appointment has been created.Goodbye" } },
          on: { SPEAK_COMPLETE: "#DM.Greeting" },
        },
        AppointmentCanceled: {
          entry: [
              { type: "spst.speak", params: { utterance: "Okay,your appointment has been canceled. Let's start over." } },
              "clearContext"
          ],
          on: { SPEAK_COMPLETE: "#DM.Greeting" },
        },
      },
    }, 

    CelebrityInfo: {
       id: "CelebrityInfo",
       initial: "CheckPerson",
       states: {
          CheckPerson: {
              always: [
                  { target: "ProvideInfo", guard: "isKnownFamousPerson" },
                  { target: "UnknownPerson", guard: "hasFamousPersonEntity" },
                  { target: "AskWho" }
              ]
          },
          AskWho: {
            entry: { type: "spst.speak", params: { utterance: "Which famous person would you like to know about?" } },
            on: { SPEAK_COMPLETE: "GetWho" },
          },
          GetWho: {
              entry: { type: "spst.listen" },
              on: {
                  ASR_NOINPUT: "NoInputWho",
                  LISTEN_COMPLETE: "ProcessCelebrityResult"
              }
          },
          ProcessCelebrityResult:{
            entry: "assignFamousPerson", 
            always: [
               
              { target: "ProvideInfo", guard: ({ context }: { context: DMContext }) => !!context.famousPersonName && context.famousPersonName.toLowerCase() in famousPerson },
              { target: "UnknownPerson", guard: ({ context }: { context: DMContext }) => !!context.famousPersonName },
              { target: "NoInputWho"}
            ]
          },
          NoInputWho: {
             entry: { 
               type: "spst.speak",
              
               params:  ({ }: { context: DMContext }) => ({ utterance:  `I didn't catch that. Which famous person would you like to know about?`})
             },
             on: { SPEAK_COMPLETE: "GetWho" }, 
          }, 
          UnknownPerson: {
           entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `Sorry, I don't have information about ${context.famousPersonName || 'that person'}. Can I help with anything else?` }) },
           on: { SPEAK_COMPLETE: "#DM.Greeting" },
         },
         ProvideInfo: {
          entry: {
            type: "spst.speak",
            params: ({ context }: { context: DMContext }) => {
              let utteranceToSend: string;
              console.log("DEBUG: Entering ProvideInfo. Context famousPersonName:", context.famousPersonName);
              if (context.famousPersonName && context.famousPersonName.toLowerCase() in famousPerson) {
                 const lowerCaseName = context.famousPersonName.toLowerCase();
                 console.log("DEBUG: Found match in famousPerson map for:", lowerCaseName);
                 utteranceToSend = famousPerson[lowerCaseName];
              } else {
                  console.warn("DEBUG: ProvideInfo - No valid famousPersonName found in context or map.", "Name in context:", context.famousPersonName, "Is in map?", (context.famousPersonName ? context.famousPersonName.toLowerCase() in famousPerson : 'N/A'));
                  utteranceToSend = " Celebrity not found.";
              }
              return { utterance: utteranceToSend };
            }
          },
          on: { SPEAK_COMPLETE: "#DM.Greeting" },
        },
       } 
    }, 
  
  } 
}); 



const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((snapshot) => {
  console.group(`State: ${typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value)}`);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => { dmActor.send({ type: "CLICK" }); });
  dmActor.subscribe((snapshot) => {
    const spstSnapshot = snapshot?.context?.spstRef?.getSnapshot();
    const defaultMeta = { view: 'Initializing' };
    const meta: { view?: string } = spstSnapshot ? (Object.values(spstSnapshot.getMeta())[0] || defaultMeta) : defaultMeta;
    element.innerHTML = `${meta.view || 'Start'}`;
  });
}
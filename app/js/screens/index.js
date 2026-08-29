import { render as welcome } from './welcome.js';
import { render as checkin, renderQuick as quickCheckin } from './checkin.js';
import { render as patient } from './patient.js';
import { render as emergency } from './emergency.js';
import { render as visit } from './visit.js';
import { render as allergies } from './allergies.js';
import { render as familyDoctor } from './familyDoctor.js';
import { render as history } from './history.js';
import { render as surgeries } from './surgeries.js';
import { render as medications } from './medications.js';
import { render as familyHistory } from './familyHistory.js';
import { render as consent } from './consent.js';
import { render as done } from './done.js';

export const SCREENS = {
  welcome, quickCheckin, checkin, patient, emergency, visit, allergies,
  familyDoctor, history, surgeries, medications, familyHistory, consent, done
};

// Personal defaults for questions that aren't in your Job Hunt Pro profile.
// The content script uses these when label-matching a field.
//
// ============================================================
// TODO(user): Fill in values that match YOUR situation.
// These answers will be used on every application. Leave "" to
// let the extension highlight the field yellow for manual review.
// ============================================================
window.__jhpFieldMap = {
  defaults: {
    // -------- Work authorization --------
    requiresSponsorship: '',          // e.g. "No" or "Yes"
    authorizedToWork: '',              // e.g. "Yes"
    currentCountry: '',                // e.g. "India"
    preferredCountry: '',              // e.g. "India"

    // -------- Role / experience --------
    yearsOfExperience: '',             // e.g. "3"
    salaryExpectation: '',             // e.g. "Negotiable"
    noticePeriodDays: '',              // e.g. "30"

    // -------- Sourcing / misc --------
    howDidYouHear: '',                 // e.g. "LinkedIn"
    preferredName: '',                 // e.g. "Shubh"
    hasNonCompete: '',                 // e.g. "No"
    previouslyWorkedHere: '',          // e.g. "No"
    needsAccommodation: '',            // e.g. "No"

    // -------- EEO (always optional) --------
    // Leave blank unless you specifically want them filled.
    gender: '',
    ethnicity: '',
    veteranStatus: '',
    disabilityStatus: '',
  },

  // Regex rules that run AFTER the hard-coded ATS selectors.
  // Each rule receives (defaults, profile) — profile fields come from
  // Job Hunt Pro, defaults from this file. First match wins.
  rules: [
    { match: /linkedin/i,                      value: (d, p) => p.linkedin_url },
    { match: /github/i,                        value: (d, p) => p.github_url },
    { match: /portfolio|website/i,             value: (d, p) => p.portfolio_url },
    { match: /sponsor/i,                       value: (d) => d.requiresSponsorship },
    { match: /authorized to work|work authorization/i, value: (d) => d.authorizedToWork },
    // Fallback: if profile has the value, use it — applies to any remaining field matching a profile key.
    { match: /current.*country|country.*residence/i,   value: (d) => d.currentCountry },
    { match: /country.*(located|hired)/i,      value: (d) => d.preferredCountry },
    { match: /years.*experience|experience.*years/i,   value: (d) => d.yearsOfExperience },
    { match: /salary|compensation.*expect/i,   value: (d) => d.salaryExpectation },
    { match: /notice period/i,                 value: (d) => d.noticePeriodDays },
    { match: /how did you hear|hear about/i,   value: (d) => d.howDidYouHear },
    { match: /preferred.*name|name.*prefer/i,  value: (d) => d.preferredName },
    { match: /non[- ]?compete|post[- ]?employment|employment agreement/i, value: (d) => d.hasNonCompete },
    { match: /previously worked|worked at|consulted for/i, value: (d) => d.previouslyWorkedHere },
    { match: /accommodation|accessible/i,      value: (d) => d.needsAccommodation },
    { match: /gender/i,                        value: (d) => d.gender },
    { match: /hispanic|ethnicity|latino/i,     value: (d) => d.ethnicity },
    { match: /veteran/i,                       value: (d) => d.veteranStatus },
    { match: /disability/i,                    value: (d) => d.disabilityStatus },
  ],
};

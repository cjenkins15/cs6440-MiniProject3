//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
}

//function to display list of medications
function displayMedication(meds) {
  med_list.innerHTML += "<li> " + meds + "</li>";
}

//function to display list of conditions
function displayCondition(meds) {
    condition_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined' &&
    typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    dia: {
      value: ''
    },
    ldl: {
      value: ''
    },
    hdl: {
      value: ''
    },
    note: 'No Annotation',
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
  hdl.innerHTML = obs.hdl;
  ldl.innerHTML = obs.ldl;
  sys.innerHTML = obs.sys;
  dia.innerHTML = obs.dia;
  height.innerHTML = obs.height;
  weight.innerHTML = obs.weight;
}

//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

    var patientObj = null;
    var patientVals = null;

// get patient object and then display its demographics info in the banner
    client.request(`Patient/${client.patient.id}`).then(
        function(patient) {
            displayPatient(patient);
            console.log(patient);
            patientObj = patient;
        }
    );

// get observation resource values
    function queryPatientVals(patientId, callback=null) { //displayBool=false,
        var query = new URLSearchParams();

        query.set("patient", patientId);
        query.set("_count", 100);
        query.set("_sort", "-date");
        query.set("code", [
            'http://loinc.org|8462-4',
            'http://loinc.org|8480-6',
            'http://loinc.org|2085-9',
            'http://loinc.org|2089-1',
            'http://loinc.org|55284-4',
            'http://loinc.org|3141-9', //measured body weight (was already here)
            'http://loinc.org|8302-2', //body height
            'http://loinc.org|29463-7', //Body Weight
        ].join(","));

        // var weightId = '';
        // var weightObs = null;
        // create patient object
        var p = defaultPatient();

        client.request("Observation?" + query, {
            pageLimit: 0,
            flat: true
        }).then(
            function(ob) {

                // group all of the observation resoruces by type into their own
                var byCodes = client.byCodes(ob, 'code');
                var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
                var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
                var hdl = byCodes('2085-9');
                var ldl = byCodes('2089-1');
                var height = byCodes('8302-2');
                var weight = byCodes('29463-7'); //byCodes('3141-9');


                // set patient value parameters to the data pulled from the observation resoruce
                if (typeof systolicbp != 'undefined') {
                    p.sys = systolicbp;
                } else {
                    p.sys = 'undefined'
                }

                if (typeof diastolicbp != 'undefined') {
                    p.dia = diastolicbp;
                } else {
                    p.dia = 'undefined'
                }

                p.hdl = getQuantityValueAndUnit(hdl[0]);
                p.ldl = getQuantityValueAndUnit(ldl[0]);
                p.height = getQuantityValueAndUnit(height[0]);
                p.weight = getQuantityValueAndUnit(weight[0]);

                if (callback != null) callback(p);
            });
        return p;
    }

    function splitHeightWeightVals(patientVals_in) {
        let mySplitWeight = patientVals_in.weight.split(" ");
        let mySplitHeight = patientVals_in.height.split(" ");
        let myWeight = mySplitWeight[0];
        let myHeight = mySplitHeight[0];
        let myWeightUnits = mySplitWeight[1].toLowerCase();
        let myHeightUnits = mySplitHeight[1].toLowerCase();
        if (myHeightUnits != "cm") {
            console.log("[splitHeightWeightVals] WARNING: Height value may not be in cm units (reported `"+myHeightUnits+"`)")
        }
        if (myWeightUnits != "kg") {
            console.log("[splitHeightWeightVals] WARNING: Weight value may not be in kg units (reported `"+myWeightUnits+"`)")
        }
        return [myHeight, myWeight];
    }

    var patientBmi = null;
    queryPatientVals(client.patient.id, function(p_in){
        patientVals = p_in;
        displayObservation(p_in);

        if (patientVals!=null){
            let hAndW = splitHeightWeightVals(patientVals)
            patientBmi = calcBmi(hAndW[0], hAndW[1]);
        } else {
            console.log("[patientBmi] patientVals is null");
            return 0;
        }
    });

    let medQuery = new URLSearchParams();
    medQuery.set("patient", client.patient.id);
    client.request("MedicationRequest?" + medQuery, {
        pageLimit: 0,
        flat: true
    }).then(
        function(MRs) {
            let property = "medicationCodeableConcept";
            if (!Array.isArray(MRs)) {
                MRs = [MRs];
            }
            MRs.forEach(function (mr) {
                if (mr.resourceType === "MedicationRequest" && mr[property]) {
                    displayMedication(mr[property].text);
                }
            });
        });

    let condQuery = new URLSearchParams();
    condQuery.set("patient", client.patient.id);
    client.request("Condition?" + condQuery, {
        pageLimit: 0,
        flat: true
    }).then(
        function(conds) {
            var property = "code";
            if (!Array.isArray(conds)) {
                conds = [conds];
            }
            conds.forEach(function (cond) {
                if (cond.resourceType === "Condition" && cond[property]) {
                    displayCondition(cond[property].text);
                }
            });
        });

// Calculates the similarity score for some other patients age to the currently shown patient, based on an average global life expectancy of 73 years
    function calcAgeSimilarity(otherAge) {
        let verbose = false;

        if (patientObj!=null){
            let myAge = new Date().getFullYear() - new Date(patientObj.birthDate).getFullYear();
            if (verbose) console.log("myAge: "+myAge);
            return Math.max(0, 1.0-Math.abs(myAge-otherAge)/73);
        } else {
            console.log("[calcAgeSimilarity] patientObj is null");
            return 0;
        }
    }

// Calculates the similarity of two sets using the Jaccard index algorithm (similarity = intersect_size / union_size)
// Source: https://docs.snowflake.com/en/user-guide/querying-approximate-similarity.html#:~:text=Examples-,Overview,)%20%2F%20(A%20%E2%88%AA%20B)
    function calcSetSimilarity(set1, set2) {
        let verbose = true;
        if (typeof set1 != 'Set')
            set1 = new Set(set1);
        if (typeof set2 != 'Set')
            set2 = new Set(set2);
        let union = new Set([...set1, ...set2]);
        let intersection = new Set([...set1].filter(i => set2.has(i)));

        let similarity = intersection.size/union.size;
        if (verbose) console.log("[calcSetSimilarity] set1.size="+set1.size+", set2.size="+set2.size+", union.size="+union.size+", intersection.size="+intersection.size+"\n   -> similarity="+similarity);
        return similarity;
    }

    function calcBmi(height_cm, weight_kg) {
        return 10000 * weight_kg / (height_cm * height_cm); //kg/m2 (10000 multiplier to convert from cm to m)
    }

    function calcBmiSimilarity(otherHeight_cm, otherWeight_kg) {
        return Math.max(0, 1-Math.abs(patientBmi - calcBmi(otherHeight_cm, otherWeight_kg))/40);
    }

// Now search through all other patients, calculate similarity to the selected, and compile a list of risk conditions
    var query = new URLSearchParams();
// query.set("_count", 100); //For now, limit the number of results to the most recent 100 to reduce computation time
// query.set("_sort", "-date");
    client.request("Patient?"+query, {
        pageLimit: 0,
        flat: true
    }).then(
        function(allPatients) {
            let verbose = false;
            const MAX_QUERY_COUNT = 100;
            const SIMILAR_DISPLAY_COUNT = 10;

            var similarPatients = {}; //Map of <patient_id, similarity_score>
            var patientNamesDobs = {}; //Map of <patient_id, [full_name, DoB]>
            var similarPatientsPQ = new PriorityQueue((a, b) => a[1] > b[1]);
            var processedSet = new Set();
            allPatients.slice(0,MAX_QUERY_COUNT).forEach(function (thisP) {
                if (thisP.resourceType === "Patient" && processedSet.size<MAX_QUERY_COUNT && similar_list.innerHTML=="Loading...") {
                    let otherAge = new Date().getFullYear() - new Date(thisP.birthDate).getFullYear();
                    let ageSimilarity = calcAgeSimilarity(otherAge);

                    queryPatientVals(thisP.id, function(otherPatientVals) {
                        if (verbose) console.log("[allPatient query] patientBmi="+patientBmi+", otherPatientVals.height=" + otherPatientVals.height + ", otherPatientVals.weight=" + otherPatientVals.weight);
                        if (typeof otherPatientVals != 'undefined' && otherPatientVals != null) {
                            let otherHAndW = splitHeightWeightVals(otherPatientVals)
                            var bmiSimilarity = calcBmiSimilarity(otherHAndW[0], otherHAndW[1]);

                            var otherName = getPatientName(thisP);
                            var avgSimilarity = (ageSimilarity + bmiSimilarity) / 2;
                            if (verbose) console.log("[allPatient query] `" + otherName + "` similarity scores: age=" + ageSimilarity + ", bmi=" + bmiSimilarity);
                            patientNamesDobs[thisP.id] = [otherName, otherAge];
                            similarPatients[thisP.id] = avgSimilarity;
                            similarPatientsPQ.push([thisP.id, avgSimilarity]);

                            processedSet.add(thisP.id);
                            if (verbose) console.log("[allPatients query] completed processing of "+processedSet.size+"/"+Math.min(allPatients.length, MAX_QUERY_COUNT)+" ("+thisP.id+")");
                            similar_list.innerHTML = "Loading... ("+processedSet.size+"/"+Math.min(allPatients.length, MAX_QUERY_COUNT)+")";

                            if ((processedSet.size >= allPatients.length-1 || processedSet.size>=MAX_QUERY_COUNT-1) && similar_list.innerHTML.startsWith("Loading...")){
                                similar_list.innerHTML = "";
                                var topIds = []; // Array of [patient_id, similarity] to be used for calculating highest risk conditions
                                var i;
                                for (i=0; i<SIMILAR_DISPLAY_COUNT; i++) {
                                    var thisIdAndScore = similarPatientsPQ.pop();
                                    topIds.push(thisIdAndScore);
                                    var thisName = patientNamesDobs[thisIdAndScore[0]][0];
                                    var thisStr = thisName.padEnd(55,".")+(thisIdAndScore[1]*100).toFixed(1)+"%";
                                    updateSimilarDisplay(thisStr);
                                    if (i===SIMILAR_DISPLAY_COUNT-1) { // If looping completed, calculate and update risk conditions
                                        var condRisks = new Map(); // Map of <condition_str, risk_val>
                                        var idsAdded = new Set(); //Set of ids for which conditions have been added (to account for asynchronicity)
                                        topIds.forEach(function(topIdAndScore){ //Loop through each of the most similar patients
                                            let topCondQuery = new URLSearchParams();
                                            topCondQuery.set("patient", topIdAndScore[0]);
                                            client.request("Condition?" + topCondQuery, {
                                                pageLimit: 0,
                                                flat: true
                                            }).then(
                                                function(topConds) {
                                                    topConds.forEach(function (topCond) { // Loop through all conditions for this patient
                                                        if (topCond.resourceType === "Condition" && topCond["code"]) {
                                                            var topCondStr = topCond["code"].text;
                                                            if (condRisks.has(topCondStr)){ // If the condition has been included from another patient, combine risk scores
                                                                condRisks.set(topCondStr, condRisks.get(topCondStr) * topIdAndScore[1]);
                                                            } else { // If the condition is new, use this patient's similarity as risk score
                                                                condRisks.set(topCondStr, topIdAndScore[1]);
                                                            }
                                                        }
                                                    });
                                                    idsAdded.add(topIdAndScore);
                                                    risk_list.innerHTML = "Loading... ("+idsAdded.size+"/"+SIMILAR_DISPLAY_COUNT+")";
                                                    if (idsAdded.size >= SIMILAR_DISPLAY_COUNT && risk_list.innerHTML.startsWith("Loading...")) { // If we have gone through conditions for all top patients, update display
                                                        var pqCondRisks = new PriorityQueue((a, b) => a[1] > b[1]);
                                                        condRisks.forEach(function (pqRisk, pqCond) { // Add all conds/risks to priority queue to sort
                                                            pqCondRisks.push([pqCond, pqRisk]);
                                                        });
                                                        if (verbose) console.log("condRisks=", condRisks);
                                                        if (risk_list.innerHTML.startsWith("Loading...")) {
                                                            risk_list.innerHTML = "";
                                                            var pqNum;
                                                            for (pqNum = 0; pqNum < pqCondRisks.size(); pqNum++) {
                                                                var currCondRisk = pqCondRisks.pop();
                                                                updateRiskDisplay(currCondRisk[0].padEnd(55, ".") + (currCondRisk[1] * 100).toFixed(1) + "%");
                                                            };
                                                        }
                                                    }
                                                });
                                        })
                                    }
                                }
                            }
                        }
                    }); //Get the relevant data for this patient
                }
            });
        });

// Takes in a mapping of <patient_id, similarity> and displays the most similar patients and highest risk conditions
    function updateSimilarDisplay(similarPatientStr) {
        document.getElementById('similar_list').innerHTML += "<li> " + similarPatientStr + "</li>";
    }

    function updateRiskDisplay(condRiskStr) {
        document.getElementById('risk_list').innerHTML += "<li> " + condRiskStr + "</li>";
    }

}).catch(console.error);

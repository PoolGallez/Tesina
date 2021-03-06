/**
 * Classe Per l'iterazione con il Database (Singleton)
 */
var singleton = null;

/**
 * Costruttore dell'helper
 */
function MongoHelper() {

  /**
   * Campi privati
   */
  var ObjectID = require('mongodb').ObjectID;
  var MongoClient = require('mongodb').MongoClient;
  var url = "mongodb://localhost:27017/Tesina";
  var assert = require("assert");
  var database;
  var socketCallback;

  /**
   * Funzione che ritorna tutte le competizioni
   */

  this.setCallback = (callback) => {
    socketCallback = callback;
  }

  this.getUserWithoutTrainer = (callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      findUserWithoutTrainer(db, (users) => {
        db.close();

        callback(users);
      })
    })
  }

  var findUserWithoutTrainer = (db, callback) => {
    var userColl = db.collection('users');
    userColl.find({ role: "Atleta", $or: [{ trainer: undefined }, { trainer: null }] }).toArray((err, arr) => {
      callback(arr);
    })
  }

  this.updateUser = (filter, data, callback) => {
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      var userColl = db.collection("users");
      updatingUser(userColl, db, filter, data, (updated) => {
        db.close();
        callback(updated);
      })
    });
  }

  var updatingUser = (userColl, db, filter, data, callback) => {


    userColl.updateOne({ email: filter.email }, { $set: data }, (err, r) => {
      assert.equal(err, null);
      assert.equal(1, r.result.n);
      callback(true);
    })
  }

  this.subscribeAthlete = (usrEmail, compId, data, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      var userColl = db.collection('users');
      userColl.find({ email: usrEmail }).toArray((err, arr) => {
        if (arr[0].subscriptions == undefined || arr[0].subscriptions == null)
          updatingUser(userColl, db, { email: usrEmail }, { subscriptions: [] }, (updated) => {
            subscribe(arr[0]._id, usrEmail, compId, data, userColl, 0, arr[0].trainer, arr[0], db, (subscribed) => {
              db.close();
              callback(subscribed);
            })
          })
        else {
          if (arr[0].subscriptions.indexOf(compId) == -1)
            subscribe(arr[0]._id, usrEmail, compId, data, userColl, arr[0].subscriptions.length, arr[0].trainer, arr[0], db, (subscribed) => {
              db.close();
              callback(subscribed);
            })
          else {

            db.close();
            callback(true);
          }
        }
      })

    })
  }

  var subscribe = (usrId, usrEmail, compId, data, userColl, subLen, trainer, user, db, callback) => {
    userColl.updateOne({ email: usrEmail }, { $push: { subscriptions: { competition: compId, dateRequest: data } } }, (err, r) => {
      assert.equal(null, err);
      assert.equal(1, r.result.n);
      var filterOptions = [usrId, trainer];
      var athleteFullname = user.name + " " + user.surname;
      getCompetitionById(compId, db, (competition) => {
        socketCallback("subscription", { filter: filterOptions, data: { name: athleteFullname, competition: competition.description } });
        callback(true);
      })
    })

  }

  this.setProgramSeen = (email, program, date, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      setSeen(email, program, date, db, (set) => {
        db.close();
        callback(set);
      })
    })
  }
  var setSeen = (email, program, date, db, callback) => {
    var userColl = db.collection("users");
    getUserFromEmail(email, userColl, (user) => {
      var userTrainings = user.trainings;
      var found = false;
      var i;
      for (i = 0; !found && i < userTrainings.length; i++) {
        if (userTrainings[i].name == program) {
          found = true;
        }
      }
      var setSeen = "trainings." + (i - 1) + ".seen";
      var obj = {};
      obj[setSeen] = date;
      console.log(JSON.stringify(obj));
      updatingUser(userColl, db, { email: email }, obj, (updated) => {
        if (updated) {
          var fullName = user.name + " " + user.surname;
          socketCallback("program-seen", { filter: user.trainer, data: { name: fullName, program: program } });
          callback(true);
        }
      })
    })
  }

  this.addAthletesToTrainer = (idsAthlete, user, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      if (user.athletes == undefined || user.athletes == null) {
        updatingUser(db.collection('users'), db, { email: user.email }, { athletes: [] }, (updated) => {
          addAthletesIntoTrainer(idsAthlete, user, db, (added) => {
            db.close();
            callback(added);
          })
        })
      } else {
        addAthletesIntoTrainer(idsAthlete, user, db, (added) => {
          db.close();
          callback(added);
        })
      }
    })
  }

  this.getPrograms = (email, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      listPrograms(email, db, (list) => {
        callback(list);
      })
    })
  }

  var listPrograms = (email, db, callback) => {
    var userColl = db.collection("users");

  }

  this.pushProgram = (emailAthletes, programUrl, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      registerProgram(emailAthletes, programUrl, db, (registered) => {
        db.close();
        callback(registered);
      })
    })
  }

  var registerProgram = (emailAthletes, programUrl, db, callback) => {
    var userColl = db.collection('users');
    var tmp = new Date();
    var today = tmp.getDate() + "/" + tmp.getMonth() + "/" + tmp.getFullYear();
    var name = programUrl.substring(programUrl.indexOf("/") + 1, programUrl.length);
    userColl.updateMany({ email: { $in: emailAthletes } }, { $push: { trainings: { name: name, url: programUrl, assign: today, seen: false } } }, { upsert: true }, (err, r) => {
      assert.equal(err, null);
      assert.equal(emailAthletes.length, r.result.n);
      getAthletesWithEmail(emailAthletes, userColl, (athletes) => {
        socketCallback("program-stored", { filter: athletes, data: "" });
        callback(true);
      })

    });
  }
  var getAthletesWithEmail = (emails, userColl, callback) => {
    userColl.find({ email: { $in: emails } }).toArray((err, arr) => {
      assert.equal(null, err);
      var ids = [];
      arr.forEach((id) => {
        ids.push(id._id);
      })
      callback(ids);
    })
  }

  var addAthletesIntoTrainer = (idsAthletes, user, db, callback) => {
    var userColl = db.collection('users');
    userColl.update({ email: user.email }, { $push: { athletes: { $each: idsAthletes } } }, (err, r) => {


      assert.equal(err, null);
      assert.equal(1, r.result.n);
      callback(true);
    });
  }

  this.setAthletesTrainer = (idsAthletes, user, callback) => {

    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      setTrainer(idsAthletes, user, db, (set) => {
        db.close();
        callback(set);
      })
    })
  }

  var setTrainer = (idsAthletes, user, db, callback) => {
    var userColl = db.collection('users');
    var objectIds = [];
    idsAthletes.forEach((id) => {
      objectIds.push(new ObjectID(id));
    })
    console.log(objectIds);
    userColl.updateMany({ _id: { $in: objectIds } }, { $set: { trainer: user._id } }, (err, r) => {
      assert.equal(err, null);
      assert.equal(objectIds.length, r.result.n);
      getAthletesIdArray(idsAthletes, userColl, (athletes) => {
        var trainerFullName = user.name + " " + user.surname;
        for (var i = 0; i < athletes.length; i++) {
          socketCallback("trainer-set", { filter: athletes[i]._id, data: trainerFullName })
        }
        callback(true);
      })

    })
  }

  this.getAthleteSubscriptions = (email, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      getSubscriptions(email, db, (subscriptions) => {
        db.close();
        callback(subscriptions);
      })
    })
  }
  var getSubscriptions = (email, db, callback) => {
    var userColl = db.collection('users');
    userColl.find({ email: email }, { subscriptions: 1 }).toArray((err, arr) => {
      callback(arr[0].subscriptions);
    })
  }

  this.subscribeAthletes = (idsAthletes, competition, data, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      var userColl = db.collection('users');
      var objectIds = [];
      for (var i = 0; i < idsAthletes.length; i++)
        objectIds.push(new ObjectID(idsAthletes[i]));
      userColl.find({ _id: { $in: objectIds } }).toArray((err, arr) => {
        var i = 0;
        arr.forEach(function (elem) {
          if (elem.subscriptions == undefined || elem.subscriptions == null)
            updatingUser(userColl, db, { email: elem.email }, { subscriptions: [] }, (updated) => {
              subscribeMultipleAthletes(objectIds, competition, db, data, userColl, (subscribed) => {
                db.close();
                callback(subscribed);
              })
            })
          else {
            var subscriptions = [];
            for (var i = 0; i < elem.subscriptions.length; i++)
              subscriptions.push(elem.subscriptions[i].competition);
            if (subscriptions.indexOf(competition) == -1)
              subscribeMultipleAthletes(objectIds, competition, db, data, userColl, (subscribed) => {
                db.close();
                callback(subscribed);
              })
            else {
              var arrayIndex = subscriptions.indexOf(competition);
              var updateCellArray = "subscriptions." + arrayIndex + ".accepted";
              var dataToSet = {};
              dataToSet[updateCellArray] = data;

              updatingUser(userColl, db, { email: elem.email }, dataToSet, (updated) => {
                if (updated)
                  getCompetitionById(competition, db, (compData) => {
                    socketCallback("trainer-subscribed", { filter: idsAthletes, data: compData })
                    callback(true);
                  })
              })

            }
          }
          if (i == arr.length)
            callback(true);
          i++;
        })

      })
    })
  }


  var subscribeMultipleAthletes = (idsAthletes, competition, db, data, userColl, callback) => {
    userColl.updateMany({ _id: { $in: idsAthletes } }, { $push: { subscriptions: { competition: competition, dateRequest: "", accepted: data } } }, (err, r) => {
      assert.equal(err, null);
      assert.equal(idsAthletes.length, r.result.n);
      getCompetitionById(competition, db, (compData) => {
        console.log("Compdata: " + compData)
        for (var i = 0; i < idsAthletes.length; i++) {
          socketCallback("trainer-subscribed", { filter: idsAthletes[i], data: compData })
        }
        callback(true);
      })
    })
  }


  this.subscribeMultipleCompetitions = (idAthlete, competitions, data, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      subscribeToMultipleCompetitions(idAthlete, competitions, db, data, (subscribed) => {
        db.close();
        callback(subscribed)
      })
    })
  }

  var subscribeToMultipleCompetitions = (idAthlete, competitions, db, data, callback) => {
    console.log(data)
    var userColl = db.collection("users");
    getAthletesIdArray([idAthlete], userColl, (user) => {
      var sub = user[0].subscriptions;
      var indexes = [];
      for (var i = 0; i < sub.length; i++)
        for (var j = 0; j < competitions.length; j++)
          if (sub[i].competition + "" == competitions[j] + "")
            indexes.push(i);
      var dataToSet = {};
      for (var i = 0; i < indexes.length; i++)
        dataToSet["subscriptions." + indexes[i] + ".accepted"] = data;
      updatingUser(userColl, db, { email: user[0].email }, dataToSet, (updated) => {
        if (updated) {
          var objectIds = [];
          for (var i = 0; i < competitions.length; i++)
            objectIds.push(new ObjectID(competitions[i]));
          getCompFromArray(objectIds, db, (comps) => {
            console.log(comps);
            socketCallback("trainer-subscribed", { filter: idAthlete, data: comps })
            callback(true);
          })
        }
        else
          callback(false);
      })
    })

  }

  var getCompetitionById = (competitionId, db, callback) => {

    var compColl = db.collection('competitions');
    compColl.find({ _id: new ObjectID(competitionId) }).toArray((err, arr) => {
      callback(arr[0])
    })
  }

  this.getAthletesWithIds = (athletesId, callback) => {
    if (athletesId != undefined || athletesId != null) {
      MongoClient.connect(url, (err, db) => {
        assert.equal(null, err);
        var userColl = db.collection('users');
        getAthletesIdArray(athletesId, userColl, (athletes) => {
          db.close();
          callback(athletes);
        })
      })
    } else {
      callback([]);
    }
  }

  var getAthletesIdArray = (athletesId, userColl, callback) => {
    var objectIds = [];
    for (var i = 0; i < athletesId.length; i++) {
      objectIds.push(new ObjectID(athletesId[i]));
    }
    userColl.find({ _id: { $in: objectIds } }).toArray((err, arr) => {
      assert.equal(null, err);
      callback(arr);
    })
  }

  this.getCompetitions = (callback) => {
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      findCompetitions(db, (competitions) => {
        db.close();
        callback(competitions);
      })
    });
  }

  var findCompetitions = (db, callback) => {
    var competitionsColl = db.collection('competitions');
    var competitions = [];
    var dat = new Date();
    var dateToQuery = dat.getDate() + "/" + (parseInt(dat.getMonth()) + 1);
    var dateToEnd = "1/" + (parseInt(dat.getMonth()) + 2);
    console.log(dateToQuery + " " + dateToEnd)
    competitionsColl.find({}).toArray((err, coll) => {
      coll.forEach(function (element) {
        competitions.push(element);

      }, this);
      findScales(db, (scales) => {
        competitions.forEach((elem) => {
          var index = scales.findIndex((item, i) => {
            return item.key == elem.scale
          })
          if (scales[index] != undefined)
            elem.scale = scales[index].name;
        })
        callback(competitions);
      })
    });
  }

  this.getScales = (callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      findScales(db, (scales) => {
        db.close();
        callback(scales);
      })
    })
  }

  var findScales = (db, callback) => {
    var scalesColl = db.collection("scale");
    scalesColl.find({}).toArray((err, arr) => {
      callback(arr)
    })
  }


  this.getCompetitionsWithinArray = (ids, callback) => {
    if (ids != undefined || ids != null) {
      var objectIds = [];
      ids.forEach((id) => {
        objectIds.push(new ObjectID(id.competition));
      })

      MongoClient.connect(url, (err, db) => {
        assert.equal(null, err);
        getCompFromArray(objectIds, db, (competitions) => {
          db.close();
          callback(competitions);
        })
      })
    } else {
      callback([]);
    }
  }

  var getCompFromArray = (ids, db, callback) => {
    var compColl = db.collection('competitions');
    compColl.find({ _id: { $in: ids } }).toArray((err, arr) => {
      callback(arr);
    })
  }


  this.getUserByEmail = (email, callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      var userColl = db.collection('users');
      getUserFromEmail(email, userColl, (user) => {
        db.close();
        callback(user);
      })
    })
  }

  var getUserFromEmail = (email, userColl, callback) => {
    userColl.find({ email: email }).toArray((err, arr) => {
      assert.equal(null, err);
      callback(arr[0]);
    })
  }

  this.logUser = (user) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      findUser(db, user, (found) => {
        db.close();
        if (!found)
          return "Si è verificato un errore durante il login";
      });
    });
  }
  var findUser = (db, user, callback) => {
    var usersColl = db.collection('users');

    function requestRegistration() {
      doRegistration(usersColl, user, (registered) => {
        callback(registered);
      })
    }
    usersColl.find({
      email: user.email
    }).toArray((err, users) => {
      if (users.length == 0)
        requestRegistration();
      else
        callback(true);
    })
  }

  var doRegistration = (userColl, user, callback) => {
    userColl.insert(user, (err, result) => {
      assert.equal(null, err);
      callback(true);
    })
  }

  this.registerUser = (user, callback) => {
    var success = true;
    MongoClient.connect(url, function (err, db) {
      assert.equal(null, err);
      var userColl = db.collection('users');
      doRegistration(userColl, user, (registered) => {
        db.close();
        if (!registered)
          success = "Error";
        callback(true);
      })
    });
  }
  this.getRoles = (callback) => {
    MongoClient.connect(url, (err, db) => {

      assert.equal(null, err);
      var roleColl = db.collection('role');
      var roles = findRoles(roleColl, (rol) => {
        db.close();
        callback(rol);
      });
    })
  }

  var findRoles = (roleColl, callback) => {
    roleColl.find({}, {
      name: 1,
      _id: 0
    }).toArray((err, arr) => {
      callback(arr)
    })

  }

  this.getAthleteCategory = (callback) => {
    MongoClient.connect(url, (err, db) => {
      assert.equal(null, err);
      var catColl = db.collection("athleteCategory");
      findCategories(catColl, (result) => {
        db.close();
        callback(result);
      })
    })
  }

  var findCategories = (catColl, callback) => {
    catColl.find({}, {
      categoryName: 1,
      _id: 0
    }).toArray((err, categories) => {
      callback(categories);
    })
  }

};

/**
 * Funzione che viene esportata (Viene utilizzare per il pattern singleton)
 */
module.exports = function getHelper() {
  if (singleton == null)
    singleton = new MongoHelper();
  return singleton;
}

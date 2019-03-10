App = {
  web3Provider: null,
  contracts: {},
  numOfBounties: 0,
  latestBlock: 0,

  init: function () {
    App.showMain();
    return App.initWeb3();
  },
  copyToClipboard: function (text) {
    var dummy = document.createElement("input");
    document.body.appendChild(dummy);
    dummy.setAttribute('value', text);
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
  },
  clickOnText: function (id) {
    var text = $(".bounty-text[data-id='" + id + "']").text();
    App.copyToClipboard(text);
    App.showNormalMessage("Tweet copied to clipboard!");
  },
  initWeb3: function () {
    
    // Is there an injected web3 instance?
    if (typeof web3 !== 'undefined') {
      console.log('web3 is enabled')
      if (web3.currentProvider.isMetaMask === true) {
        App.web3Provider = web3.currentProvider;}
          console.log('MetaMask is active')
         
        } else {
          console.log('MetaMask is not available');
        
          App.showErrorMessage('Please install MetaMask add-on and set network to Rinkeby to access the content');
          return;

      } 
      
    web3 = new Web3(App.web3Provider);
    var account = web3.eth.accounts[0];
    $("#current-account-address").text(account);
    $("#twitter-url").text('');
    $(".tutorial").hide();
    var accountInterval = setInterval(function () {
      if (web3.eth.accounts[0] !== account) {
        account = web3.eth.accounts[0];
        $("#current-account-address").text(account);
        App.showBounties($("#topic-selector").val());
      }
    }, 100);
    return App.initContract();
  },
  initContract: function () {

    $.getJSON('TopicshareBounty.json', function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var TopicshareBountyArtifact = data;
      App.contracts.TopicshareBounty = TruffleContract(TopicshareBountyArtifact);

      // Set the provider for our contract
      App.contracts.TopicshareBounty.setProvider(App.web3Provider);
      return App.showBounties($("#topic-selector").val());
    }).then(function () {
      // Add on-click events to all the buttons that get created on the page
      return App.bindEvents();
    });

  },
  bindEvents: function () {
    // Add events to all the buttons on the page
    $("#submit-oracle").click(App.oraclizeTweet);
    $("#submit-twitter-bounty").click(App.submitTwitterBounty);
    $("#create-bounty-jumbo").click(App.buyCalls);
    $("#fulfill-bounty-jumbo").click(App.showFulfillBountyInput);
    $("#fulfill-bountyid-input").change(App.checkBountyFulfill);
    $("#fulfill-twitter-bounty").click(App.completeBounty);
    // All bounty cards are marked with "data-id" property
    $(document).on('click', '.btn-close', (function () {
      var id = $(this).data('id');
      App.closeBounty(id);
    }));
    $(document).on('click', '.btn-fulfillment', (function () {
      var id = $(this).data('id');
      App.editBountyFulfillment(id);
    }));
    $(document).on('click', '.bounty-text', (function () {
      var id = $(this).data('id');
      App.clickOnText(id);
    }));
    $("#topic-selector").change(function () {
      App.showBounties(this.value);
    });
    $(document).on('click', '.btn-contribute', (function () {
      var id = $(this).data('id');
      App.contributeToBounty(id);
    }));
    $(document).on('click', '.go-back', (function () {
      App.showMain();
    }));

    // Then add event listeners for the different contract events
    return App.eventListeners();
  },

  eventListeners: function () {
    web3.eth.getBlockNumber(function (error, result) {
      if (!error) {
        App.latestBlock = result;
      }
    });
    console.log("Initializing events listeners...");
    // Add event listeners to update the UX when different contract events occur
    var topicshareBountyInstance;
    App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;

      // Listen for a bounty to update its payout
      var PayoutChanged = topicshareBountyInstance.PayoutChanged();
      PayoutChanged.watch(function (error, result) {
        if (!error) {
          console.log("Updating Campaign #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
          $(".modify-bounty-container[data-id='" + result.args._bountyId.toNumber() + "']").collapse('hide');
        }
      });

      // Listen for a bounty to be fulfilled
      var BountyFulfilled = topicshareBountyInstance.BountyFulfilled();
      BountyFulfilled.watch(function (error, result) {
        if (!error) {
          console.log("Updating Campaign #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
        }
      });

      // Listen for a bounty to be bought
      var BountyBought = topicshareBountyInstance.BountyBought();
      BountyBought.watch(function (error, result) {
        if (!error) {
          App.showNormalMessage("Campaign created succsesfully!");
          App.showCreateBountyInput();
        } else {
          App.showErrorMessage("Failed buying calls!");
        }
      });

      // Listen for someone to contribute to a bounty
      var ContributionAdded = topicshareBountyInstance.ContributionAdded();
      ContributionAdded.watch(function (error, result) {
        if (!error) {
          console.log("Updating Campaign #" + result.args._bountyId.toNumber());
         
          App.updateBounty(result.args._bountyId.toNumber());
        }
      });

      // Listen for the owner to close a bounty and update the UX
      var BountyClosed = topicshareBountyInstance.BountyClosed();
      BountyClosed.watch(function (error, result) {
        if (!error) {
          console.log("Closing Campaign #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
        } else {
          App.showErrorMessage("Failed closign campaign!");
        }
      });

      // Listen for a bounty to be created and show it in the UX
      // Here we have to check to not grab events from the current block
      var BountyCreated = topicshareBountyInstance.BountyCreated({ fromBlock: App.latestBlock });
      BountyCreated.watch(function (error, result) {
        if (!error) {
          if (result.blockNumber != App.latestBlock) {
            console.log("Adding Campaign #" + result.args._bountyId.toNumber());
            App.showBounties("Latest");
            //location.reload();
          }
        }
      });
          // set the fee price on reload
    App.getPrice();
  });
  },

  // Update the properties on the bounty including "closing" it
  updateBounty: function (bountyId) {
    App.getNumOfFulfillments(bountyId).then(function (fullfilments) {
      var topicshareBountyInstance;
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;
        return topicshareBountyInstance.getBounty(bountyId);
      }).then(function (result) {
        bountyObject = App.convertToBountyObject(result);
        if (bountyObject.bountyOpen) {
          $(".bounty-topic[data-id='" + bountyId + "']").text(bountyObject.topic);
          $(".fulfillment-amount[data-id='" + bountyId + "']").text(web3.fromWei(bountyObject.fulfillmentAmount, 'ether'));
          $(".bounty-balance[data-id='" + bountyId + "']").text(web3.fromWei(bountyObject.balance, 'ether'));
          $(".fulfillment-followers[data-id='" + bountyId + "']").text(bountyObject.follows);
          $(".bounty-claims[data=id='" + bountyId + "']").text(fullfilments);
        } else {
          $(".bounty-claims-holder[data-id='" + bountyId + "']").hide();
          $(".fulfillment-amount-group[data-id='" + bountyId + "']").hide();
          $(".fulfillment-followers-group[data-id='" + bountyId + "']").hide();
          $(".bounty-balance-group[data-id='" + bountyId + "']").hide();
          $(".btn-group[data-id='" + bountyId + "']").empty();
          $(".btn-group[data-id='" + bountyId + "']").append("<div class='btn btn-sm btn-outline-danger'>Campaign Closed</button>");
        }
      });
    });
  },
  buyCalls: function () {
    var topicshareBountyInstance;
    App.contracts.TopicshareBounty.deployed().then(function (instance) {
      App.showNormalMessage("Starting campaign, please wait...");
      topicshareBountyInstance = instance;
      return topicshareBountyInstance.checkCalls();
    }).then(function (result) {
      console.log("Can make campaign: " + result);
      if (result) {
        return App.showCreateBountyInput();
      } else {
        App.buyCallsNow();}
      });
  },
  buyCallsNow: function() {
    var topicshareBountyInstance;
    App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
      return topicshareBountyInstance.getFee()
    }).then(function (result) {
      var price = web3.fromWei(result);
      console.log("Buying campaign: " + price);
      return topicshareBountyInstance.buyCalls({ value: result });
    });
  },
  showHowToCreate: function () {
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".claim").hide();
    $(".edit").hide();
    $(".devlog").hide();
    $(".work").hide();
    $(".fees").hide();
    $(".privacy").hide();
    $(".tutorial").show();
    $(".create").show();
  },
  showHowToClaim: function () {
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".create").hide();
    $(".fees").hide();
    $(".devlog").hide();
    $(".privacy").hide();
    $(".work").hide();
    $(".edit").hide();
    $(".tutorial").show();
    $(".claim").show();
  },
  showHowToEdit: function () {
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".create").hide();
    $(".privacy").hide();
    $(".devlog").hide();
    $(".work").hide();
    $(".fees").hide();
    $(".claim").hide();
    $(".tutorial").show();
    $(".edit").show();
  },
  showHowToFees:function() {
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".create").hide();
    $(".privacy").hide();
    $(".claim").hide();
    $(".work").hide();
    $(".devlog").hide();
    $(".edit").hide();
    $(".tutorial").show();
    $(".fees").show();
  },
  showPrivacyPolicy: function() {
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".create").hide();
    $(".fees").hide();
    $(".devlog").hide();
    $(".claim").hide();
    $(".edit").hide();
    $(".work").hide();
    $(".tutorial").show();
    $(".privacy").show();
  },
  showWork: function() {
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".create").hide();
    $(".fees").hide();
    $(".claim").hide();
    $(".edit").hide();
    $(".devlog").hide();
    $(".privacy").hide();
    $(".tutorial").show();
    $(".work").show();
  },
  showDevlog: function(){
    $(".jumbotron").hide();
    $("#navbarHeader").collapse('hide');
    $(".create").hide();
    $(".fees").hide();
    $(".claim").hide();
    $(".edit").hide();
    $(".devlog").hide();
    $(".privacy").hide();
    $(".work").hide();
    $(".tutorial").show();
    $(".devlog").show();
  },
  showMain: function () {
    $(".tutorial").hide();
    $(".jumbotron").show();
    $("#navbarHeader").collapse('hide');
    
  },
  getPrice: function () {
    var topicshareBountyInstance;
   App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
     return  topicshareBountyInstance.getFee();
    }).then(function (result) {
      var fee = web3.fromWei(result);
      console.log("Fee: " + fee + " ETH");
      $('.gas-price-ui').text(fee + ' Ether');
      return result;
    });
  },
  // Add an error message to the jumbotron
  showErrorMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").addClass('alert-danger').removeClass('alert-secondary');
    $("#message-output-container").collapse('show');
  },

  // Add a normal message to the jumbotron
  showNormalMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").removeClass('alert-danger').addClass('alert-secondary');
    $("#message-output-container").collapse('show');
  },
  // Get the number of bounties stored in the contract
  getNumOfBounties: function () {
    var topicshareBountyInstance;
    return App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
      return topicshareBountyInstance.getNumBounties();
    }).then(function (result) {
      console.log("Num of bounties: " + result);
      App.numOfBounties = result.toNumber();
      return App.numOfBounties;
    });
  },

  // Get number of fullfilments for a compaign given its bountyId
  getNumOfFulfillments: function (_bountyId) {
    var topicshareBountyInstance;
    return App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
      return topicshareBountyInstance.getNumFulfillments(_bountyId);
    }).then(function (result) {
      console.log("Num of claims for campaign " + _bountyId + ": " + result);
      return result;
    });
  },

  // Convert the tuple returned from the contract into a bounty object
  convertToBountyObject: function (bountyArray) {
    return {
      bountyIssuer: bountyArray[0],
      data: bountyArray[1],
      topic: bountyArray[2],
      follows: bountyArray[3],
      fulfillmentAmount: bountyArray[4],
      balance: bountyArray[5],
      bountyOpen: bountyArray[6]
    }
  },
  // Allow the user to contribute to a bounty, add the listener function to the button to call the contract
  contributeToBounty: function (id) {
    $(".modify-bounty-container[data-id='" + id + "']").collapse('show')
    $(".modify-bounty-button[data-id='" + id + "']").text("Contribute")
    $(".modify-bounty-button[data-id='" + id + "']").addClass('btn-outline-success').removeClass('btn-outline-secondary')
    $(".modify-bounty-button[data-id='" + id + "']").unbind()
    $(".modify-bounty-button[data-id='" + id + "']").click(function () {
      var twitterBountyInstance;
      var amount = $(".modify-bounty-input[data-id='" + id + "']").val();
      var amountWei = web3.toWei(amount, 'ether');
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;
        return instance.contribute(id, { value: amountWei });
      });
    });
  },
  // Given a bounty object, create a new card for it on the webpage
  showBounty: function (bountyObject, index) {
    // Oraclize sometimes returns an array, which we want to join into a normal array
    var testStr;
    try {
      testStr = JSON.parse(bountyObject.data).join("");
    } catch {
      testStr = bountyObject.data;
    }

    var newStr = "";
    // if(testStr.includes("http")|| testStr.includes("pic")){ 
    //   newStr = testStr.replace('http', ' http').replace('pic.', ' pic.');
    // }
    App.getNumOfFulfillments(index).then(function (result) {
      var bountyRow = $('#bountyRow');
      // This is an HTML template for a bounty card
      var bountyTemplate = $('#bountyTemplate').clone(true, true);
      bountyTemplate.find('.bounty-text').text(newStr == "" ? testStr : newStr);
      bountyTemplate.find('.bounty-issuer').text(bountyObject.bountyIssuer);
      bountyTemplate.find('.bounty-topic').text(bountyObject.topic);
      bountyTemplate.find('.fulfillment-followers').text(bountyObject.follows);
      bountyTemplate.find('.fulfillment-amount').text(web3.fromWei(bountyObject.fulfillmentAmount, 'ether'));
      bountyTemplate.find('.bounty-balance').text(web3.fromWei(bountyObject.balance, 'ether'));
      bountyTemplate.find('.bounty-number').text(index);
      bountyTemplate.find('.bounty-claims').text(result);
      if (bountyObject.bountyOpen) {
        // Add the data-id to all the properties on the bounty card template
        bountyTemplate.find('*').attr('data-id', index);
        // Check if the logged in user is NOT the bounty owner
        if (bountyObject.bountyIssuer != web3.eth.accounts[0]) {
          bountyTemplate.find('.btn-fulfillment').remove();
          bountyTemplate.find('.btn-close').remove();

        }
      } else {
        // If the bounty is closed
        bountyTemplate.find('.bounty-claims-holder').hide();
        bountyTemplate.find('.fulfillment-followers-group').hide();
        bountyTemplate.find('.fulfillment-amount-group').hide();
        bountyTemplate.find('.bounty-balance-group').hide();
        bountyTemplate.find('.btn-group').empty();
        bountyTemplate.find('.btn-group').append("<div class='btn btn-sm btn-outline-danger'>Campaign Closed</button>")
      }
      //Add it to the front of the list
      bountyRow.prepend(bountyTemplate.html());
    });
  },
  showBounties: function (category) {
    // Clear the bounty area
    $('#bountyRow').empty();
    var topicshareBountyInstance;
    App.getNumOfBounties().then(function () {
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        // Array of promises to store all "getBounty" requests
        var promises = [];
        // Show message if there are no bounties
        if (App.numOfBounties == 0) {
          console.log("No Campaigns")
          $("#bountyRow").text("No campaigns have been created yet!");
        } else {
          topicshareBountyInstance = instance;
          // Push all bounties to Promise array, one for bounty index, one for bounty object
          for (i = 0; i < App.numOfBounties; i++) {
            promises.push(i);
            promises.push(topicshareBountyInstance.getBounty(i))
          }
        }
        return promises;
      }).then(function (promises) {
        // Resolve all promises, and 'untangle' index data from bounty object
        Promise.all(promises).then(function (result) {
          if (category == "Latest" || category == "") {
            for (i = 0; i < result.length; i += 2) {
              bountyObject = App.convertToBountyObject(result[i + 1]);
              if (bountyObject.balance > 0) { //show only open campaign and with balance > 0
                // Show the bounty in the UX
                App.showBounty(bountyObject, result[i]);
              }
              console.log("Loading latest");
            }
          } else {
            for (i = 0; i < result.length; i += 2) {
              bountyObject = App.convertToBountyObject(result[i + 1]);
              // Show the bounty in the UX by topic
              if (bountyObject.balance > 0) { //show only open campaign and with balance > 0
                if (bountyObject.topic == category) {
                  App.showBounty(bountyObject, result[i]);
                  console.log('Loading topic: ' + bountyObject.topic);
                }
              }
            }
          }
        });
      })
    });
  },
  // Take the tweet input, check it, and then initiate the oraclize call
  oraclizeTweet: function () {

    var topicshareBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    
    $("#tweet-output").collapse('hide');
    
    // Check the URL is formatted correctly
    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;
        
        // Check if the tweet has already been oraclized
        return topicshareBountyInstance.getTweetText(tweetId)

      }).then(function (result) {
        // If not, go and oraclize the tweet
        if (result == "") {
          $("#tweet-output").collapse('hide');
          App.showNormalMessage('Processing transaction, stand by...');
          return topicshareBountyInstance.oraclizeTweet(tweetId);
          // Otherwise, just show the text we already stored
        } else {
          $("#tweet-output").collapse('hide');
          App.checkProfanities(result);
          return result;
        }
      }).then(function () {
        // Loop and check the oracle to successfully complete oraclizing
        App.checkOracle(0);
      });
    } else {
      App.showErrorMessage("Bad URL")
    }
  },
  checkProfanities: function (text) {
   
    App.showOracleTweetText(text);
  },
  // Show the result from Oraclize in the Jumbotron
  showOracleTweetText: function (result) {
    var testStr;

    try {
      testStr = JSON.parse(result).join("");
    } catch {
      testStr = result;
    }

    var newStr = "";
    // if(testStr.includes("http")|| testStr.includes("pic")){
    //   console.log("Has link: " + testStr); 
    //   newStr = testStr.replace('http', ' http').replace('pic.', ' pic.');
    // }

    $("#tweet-oracle-text").text(newStr == "" ? testStr : newStr);
    $("#message-output-container").collapse('hide');
    $("#create-bounty-input").collapse('hide');
    $("#fulfill-bounty-input").collapse('hide');
    $("#tweet-output").collapse('show');
  },

  // This function loops every second to check if the oracle has completed the process. After 2 minutes, it returns an error message
  checkOracle: function (count) {
    // Adjust this count if you want to wait longer or shorter
    if (count > 100) {
      App.showErrorMessage("Something went wrong with oraclizing this tweet.");
      return;
    }
    var topicshareBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;
        return topicshareBountyInstance.getTweetText(tweetId);
      }).then(function (result) {
        // We assume "" means the tweet was not retrieved
        if (result == "") {
          // Show loading message
          App.showNormalMessage("Checking tweet, please wait... (" + count + ")");
          // Recursively call the function after 1 second
          setTimeout(function () {
            App.checkOracle(count + 1);
          }, 1000);
        } else {
          // When done, show the tweet text and end the loop
          App.checkProfanities(result);
          return;
        }
      });
    } else {
      console.log("Bad URL");
    }
  },
  checkFollowOracle: function (count) {
    // Adjust this count if you want to wait longer or shorter
    if (count > 80) {
      App.showErrorMessage("Something went wrong with oraclizing this tweet.");
      return;
    }
    var bountyId = $('#fulfill-bountyid-input').val();
    var tweetUrl = $('#twitter-url').val();
    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      var array_ = tweetId.split('/');
      var profileId = array_[0];
      var topicshareBountyInstance;

      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;

        return topicshareBountyInstance.getFollowers(profileId);
      }).then(function (result) {
        // We assume "" means the tweet was not retrieved
        if (result == "") {
          // Show loading message
          App.showNormalMessage("Checking followers, please wait... (" + count + ")");
          // Recursively call the function after 1 second
          setTimeout(function () {
            App.checkFollowOracle(count + 1);
          }, 1000);
        } else {
          // When done, show the tweet text and end the loop
          App.showOracleFollowText(bountyId, result, profileId);
          return;
        }
      });
    } else {
      console.log("Bad URL");
    }
  },
  showOracleFollowText: function (bountyId, followers, profileId) {
    console.log("Followers: " + followers + " CampaignId: " + bountyId);
    var topicshareBountyInstance;
    App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
      return topicshareBountyInstance.getBounty(bountyId);
    }).then(function (result) {
      bountyObject = App.convertToBountyObject(result);
      var required = bountyObject.follows;
      console.log("Followers: " + followers + " Required: " + required);
      if (Number(followers) >= Number(required)) {
        $("#fulfill-bountyid-message").text("Followers good. Checking tweet!");
        App.claimBounty();
      } else {
        App.showErrorMessage("Not enough followers!");
        return;
      }
    });
  },
  // Calls the contract to create a new Twitter bounty
  createTwitterBounty: function (fulfillmentAmount, postId, initialBalance, topic, follows) {
    var topicshareBountyInstance;
    var initialBalanceWei = web3.toWei(initialBalance, 'ether');
    var fulfillmentAmountWei = web3.toWei(fulfillmentAmount, 'ether');
    App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
      var bountyId;
      //First "call" to get which Bounty ID would be created
      topicshareBountyInstance.createBounty.call(fulfillmentAmountWei, postId, topic, follows, { value: initialBalanceWei })
        .then(function (id) {
          bountyId = id;
          //Then actually make the call
          return topicshareBountyInstance.createBounty(fulfillmentAmountWei, postId, topic, follows, { value: initialBalanceWei })
        });
    });
  },
  // Get the data from the UX to make the correct call to the contract
  submitTwitterBounty: function () {
    var fulfillmentAmount = $("#fulfillment-amount-input").val();
    var initialBalance = $("#initial-balance-input").val();
    var tweetUrl = $('#twitter-url').val();
    var topic = $('#topic-input').val();
    var followers = $('#followers-dropdown').val();

    console.log('Topic choosen: ' + topic + ". Followers requested: " + followers + ". Amount: " + initialBalance);
    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      App.showNormalMessage('Processing transaction, stand by...');
      App.createTwitterBounty(fulfillmentAmount, tweetId, initialBalance, topic, followers);
    } else { console.log("Bad URL"); }
  },
  // Acts as a toggle for Bounty over Fulfill
  showCreateBountyInput: function () {
    $("#create-bounty-input").collapse('show');
    $("#fulfill-bounty-input").collapse('hide');
  },
  // Acts as a toggle for Fulfill over Bounty, loads the options to select a bounty # to fulfill
  showFulfillBountyInput: function () {
    $("#fulfill-bountyid-input").empty();
    $("#fulfill-bountyid-message").empty();
    $("#fulfill-twitter-bounty").prop('disabled', true)
    $("#fulfill-twitter-bounty").removeClass("btn-outline-success").removeClass("btn-outline-danger").addClass("btn-outline-secondary")
    $("#fulfill-bountyid-input").append("<option selected>Choose campaign</option>")
    for (i = App.numOfBounties - 1; i >= 0; i--) {
      $("#fulfill-bountyid-input").append("<option val='" + i + "'>" + i + "</option>");
    }
    $("#create-bounty-input").collapse('hide');
    $("#fulfill-bounty-input").collapse('show');
  },

  // Check if an oraclized tweet will fulfill a bounty
  checkBountyFulfill: function () {
    $("#fulfill-bountyid-message").text("Checking followers...");
    App.showNormalMessage('Processing transaction, stand by...');
    App.oraclizeFollowers();
  },
  // Contract call to fulfill the bounty
  claimBounty: function () {
    var topicshareBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      var tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TopicshareBounty.deployed().then(function (instance) {

        topicshareBountyInstance = instance;
        return topicshareBountyInstance.fulfillBounty.call(bountyId, tweetId);

      }).then(function (result) {

        // If it would work, let the user make the contract call
        if (result) {
          $("#fulfill-twitter-bounty").addClass("btn-outline-success").removeClass("btn-outline-danger").removeClass("btn-outline-secondary")
          $("#fulfill-twitter-bounty").prop('disabled', false);
          $("#message-output-container").collapse('hide');
          $("#fulfill-bountyid-message").text("Nice! Claim you reward ->");

        } else {
          $("#fulfill-bountyid-message").text("This tweet won't work...")
          $("#fulfill-twitter-bounty").prop('disabled', true);
          $("#fulfill-twitter-bounty").removeClass("btn-outline-success").addClass("btn-outline-danger").removeClass("btn-outline-secondary")
        }
      });
    }
  },
  completeBounty: function () {
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      var tweetId = tweetUrl.replace("https://twitter.com/", "");

      var topicshareBountyInstance;
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;
        App.showNormalMessage('Processing transaction, stand by...');
        // We can check without making any real contract calls. Check on the client side.
        return topicshareBountyInstance.fulfillBounty(bountyId, tweetId)
      }).then(function (result) {
        // If it would work, let the user make the contract call
        if (result) {
          $("#twitter-url").text('');
          $("#next-steps").empty();
          $("#next-steps").append(
            `<div class="alert alert-success" role="alert">
              <strong>Nice! You got your reward.</strong> Now keep sharing!
            </div>`
          );
        } else {
          $("#fulfill-bountyid-message").text("This tweet won't work...")
          $("#fulfill-twitter-bounty").prop('disabled', true);
          $("#fulfill-twitter-bounty").removeClass("btn-outline-success").addClass("btn-outline-danger").removeClass("btn-outline-secondary")
        }
      });
    }
  },
  oraclizeFollowers: function () {

    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    if (tweetUrl.includes("https://twitter.com/")) {

      tweetId = tweetUrl.replace("https://twitter.com/", "");
      var followersTextArray = tweetId.split('/');
      var _profileId = followersTextArray[0];
      console.log("Profile: " + _profileId);
      var topicshareBountyInstance;

      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;

        return topicshareBountyInstance.getFollowers(_profileId)

      }).then(function (result) {
        // If not, go and oraclize the tweet
        if (result == "") {
          return topicshareBountyInstance.oraclizeFollowers(_profileId);
          // Otherwise, just show the text we already stored
        } else {
          App.showOracleFollowText(bountyId, result);
          return result;
        }
      }).then(function () {
        // Loop and check the oracle to successfully complete oraclizing
        App.checkFollowOracle(0);
      });
    } else {
      App.showErrorMessage("Bad URL");
    }
  },
  // Contract call to close the bounty
  closeBounty: function (id) {
    var topicshareBountyInstance;
    App.contracts.TopicshareBounty.deployed().then(function (instance) {
      topicshareBountyInstance = instance;
      // When testing, I was running into out of gas issues with Metamask. I set a pretty high gas amount to prevent that
      return instance.closeBounty(id, { gas: 60000 }); //
    });
  },
  // Allow the user to edit the bounty payout, add a listner to the button to call the contract
  editBountyFulfillment: function (id) {
    $(".modify-bounty-container[data-id='" + id + "']").collapse('show');
    $(".modify-bounty-button[data-id='" + id + "']").text("Edit");
    $(".modify-bounty-button[data-id='" + id + "']").removeClass('btn-outline-success').addClass('btn-outline-secondary')
    $(".modify-bounty-button[data-id='" + id + "']").unbind();
    $(".modify-bounty-button[data-id='" + id + "']").click(function () {
      var topicshareBountyInstance;
      var amount = $(".modify-bounty-input[data-id='" + id + "']").val();
      var amountWei = web3.toWei(amount, 'ether');
      App.contracts.TopicshareBounty.deployed().then(function (instance) {
        topicshareBountyInstance = instance;
        return instance.changePayout(id, amountWei);
      });
    });
  }
};
$(function () {
  $(window).load(function () {
    App.init();
  });
});

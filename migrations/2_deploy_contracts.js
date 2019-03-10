var TopicshareOracle = artifacts.require("TopicShareOracle");
var TopicshareBounty = artifacts.require("TopicShareBounty");

module.exports = function (deployer) {
    deployer.deploy(TopicshareOracle, {value: 500000000000000000 })    
        .then(function () {
            return deployer.deploy(TopicshareBounty, TopicshareOracle.address);
        }); 
};

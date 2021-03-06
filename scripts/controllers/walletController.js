'use strict';

angular.module('walletApp')
.controller('WalletController', function(
    $scope,
    WalletDataService,
    VanityAddressService
) {

    $scope.wallet = WalletDataService.data;

    $scope.sortByBalance = function() {
        $scope.wallet = $scope.wallet.sort(function(entryA, entryB) {
            var balance = {
                a: entryA.balance || 0,
                b: entryB.balance || 0
            };
            return balance.b - balance.a;
        });
        WalletDataService.save();
    };

    $scope.addAddresses = function(addresses) {
        WalletDataService.addAddresses(addresses);
    };

    $scope.addEntry = function() {
        if (WalletDataService.addEntry($scope.inputEntry)) {
            // clean field if successfull
            delete $scope.inputEntry;
        }
    };

    $scope.deleteEntry = function(entry) {
        WalletDataService.deleteEntry(entry);
    };

    $scope.checkBalances = function() {
        WalletDataService.checkBalances();
    };

    $scope.sumBalances = function(type) {
        return WalletDataService.getSum(type);
    };

    $scope.clearWallet = function() {
        WalletDataService.clear();
    };

    $scope.generateVanity = function() {
        var vanityString = ($scope.inputEntry || '').trim();
        $scope.inputEntry = '';
        $scope.generatingVanity = true;

        VanityAddressService.fromString(vanityString).then(function(res) {
            delete $scope.generatingVanity;
            WalletDataService.addEntry(res.privkey);
        });
    };

});

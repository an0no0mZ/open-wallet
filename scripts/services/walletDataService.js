'use strict';

angular.module('walletApp').service('WalletDataService', function(
    $log,
    $q,
    StorageService,
    UtilsService,
    UndoActionService,
    BitcoinDataService,
    BitcoreService,
    WalletEntryService,
    BitcoinUtilsService,
    WalletCompressService,
    AddressWatchService
) {
    var storageKey = 'wallet';
    var data, _this;


    var findAddress = function(address) {
        for (var i = 0, l = data.length; i < l; ++i) {
            if (data[i].address === address) return data[i];
        }
        return false;
    };

    var updateAddressBalance = function(entry) {
        var deferred = $q.defer();
        var maxAttemps = 3; // TODO: make config

        entry.loading = true;

        var stopLoading = function() {
            delete entry.loading;
        };

        (function loop() {
            BitcoinDataService.getBalance(entry.address).then(function(data) {
                _.extend(entry, data);
                _this.save();

                stopLoading();
                deferred.resolve();
            }, function() {
                if (--maxAttemps > 0) {
                    loop();
                } else {
                    stopLoading();
                    deferred.resolve();
                }
            });
        })();

        return deferred.promise;
    };

    var addPrivkey = function(privkey) {
        var address = BitcoinUtilsService.privkeyToAddress(privkey);
        var walletEntry;

        if (addAddress(address)) {
            walletEntry = findAddress(address);

            walletEntry.privkey = privkey;

            _this.save();

            WalletEntryService.determineType(walletEntry);
        }
    };

    var addAddress = function(address) {
        var walletEntry = findAddress(address);
        var newEntry;

        if (!!walletEntry) {
            $log.warn('address exists in wallet');
            WalletEntryService.blink(walletEntry, 'error');
            return false;
        }
        
        newEntry = {
            address: address
        };
        data.push(newEntry);
        _this.save();

        WalletEntryService.determineType(newEntry);
        updateAddressBalance(newEntry);
        AddressWatchService.watch(newEntry.address);

        WalletEntryService.blink(newEntry, 'success');

        return true;
    };

    var saveToStorage = _.throttle(function() {
        StorageService.set(storageKey, WalletCompressService.compress(data));
    }, 5e2);

    AddressWatchService.eventListener.add('receiveCoins', function(out) {
        var entry = findAddress(out.address);

        if (entry) {
            entry.received += out.value;
            entry.balance += out.value;
        }
    });

    (function() {
        // init
        data = WalletCompressService.decompress(
            StorageService.default(
                storageKey,
                WalletCompressService.compress([{address: '1grzes2zcfyRHcmXDLwnXiEuYBH7eqNVh'}])
            )
        );

        // add watches
        _.map(data, function(entry) {
            AddressWatchService.watch(entry.address);
        });
    })();
    
    _this = {
        getSum: function(property) {
            property = property || 'balance';
            return _.reduce(data, function(sum, entry) {
                var val = entry[property]+0 ? entry[property] : 0;
                return sum + val;
            }, 0);
        },
        deleteEntry: function(entry) {
            var index = data.indexOf(entry);
            if (index === -1) return UtilsService.noop;

            UndoActionService.doAction(function() {
                data.splice(index, 1);
                _this.save();
                AddressWatchService.unwatch(entry.address);

                return {
                    reverse: function() {
                        data.splice(index, 0, entry);
                        _this.save();
                        AddressWatchService.watch(entry.address);
                    },
                    translationKey: 'DELETE_WALLET_ENTRY'
                };
            });
        },
        addEntry: function(inputEntry) {
            var address = BitcoinUtilsService.privkeyToAddress(inputEntry);

            if (_.isUndefined(inputEntry)) {
                addPrivkey( BitcoinUtilsService.generatePrivkey() );
            }

            // check if it is privkey
            if (address !== false) {
                addPrivkey(inputEntry);
                return true;
            }
            // or address…
            if (BitcoinUtilsService.isValidAddress(inputEntry)) {
                return addAddress(inputEntry);
            }
            return false;
        },
        addAddresses: function(addresses) {
            _.map(addresses, function(address) {
                addAddress(address);
            });
        },
        checkBalances: function() {
            var i = 0;

            (function loop() {
                var entry = data[i++];
                if (i > data.length) return;

                updateAddressBalance(entry).then(loop);
            })();
        },
        save: function() {
            saveToStorage();
        },
        data: data
    };
    return _this;
});

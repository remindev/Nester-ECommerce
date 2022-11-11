import * as auth from './auth.js';
import * as products from './products.js';
import * as db from './schema.js';
import * as util from './util.js';
import * as cart from './cart.js';
import * as address from './address.js';


const addTODB = (UID, addressFrom, type, save) => {
    return new Promise(async (resolve, reject) => {
        try {
            // get all products from cart
            const products = await cart.getAllProductsWithTotal(UID);

            // check for products existence
            if (products.length == 0) throw 'Nothing to checkout';

            products?.map(e => e['status'] = 'pending');

            try {
                // 
                const checkForExistingCollection = await db.orders.find({ UID: UID });

                if (checkForExistingCollection.length > 0) {
                    // order collection exists for this user

                    const data = await db.orders.updateOne({ UID: UID }, {
                        $push: {
                            orders: [
                                {
                                    products: products,
                                    address: addressFrom,
                                    paymentType: type,
                                    status: 'pending'
                                }
                            ]
                        }
                    });

                    const cartDataRemoveStatus = await db.cart.updateOne({ UID: UID }, {
                        $set: {
                            products: []
                        }
                    });

                    if (save == "YES") {

                        const dataToSave = {};
                        const keys = Object.keys(addressFrom);

                        keys.forEach(e => {
                            if (addressFrom[e]) {
                                dataToSave[e] = addressFrom[e];
                            };
                        });

                        try {
                            const saveAddress = await address.add(UID, dataToSave);
                        } catch (error) {
                            reject("Faild to save address"); return 0;
                        };

                    };

                    //...
                    resolve("Order successfully rejested");
                } else {
                    // order collection not exists for this user

                    const data = await db.orders({
                        UID: UID,
                        orders: [
                            {
                                products: products,
                                address: addressFrom,
                                paymentType: type,
                                status: 'pending'
                            }
                        ]
                    });

                    data.save();

                    const cartDataRemoveStatus = await db.cart.updateOne({ UID: UID }, {
                        $set: {
                            products: []
                        }
                    });

                    if (save == "YES") {

                        const dataToSave = {};
                        const keys = Object.keys(addressFrom);

                        keys.forEach(e => {
                            if (addressFrom[e]) {
                                dataToSave[e] = addressFrom[e];
                            };
                        });

                        try {
                            const saveAddress = await address.add(UID, dataToSave);
                        } catch (error) {
                            reject("Faild to save address"); return 0;
                        };

                    };

                    //...
                    resolve("Order successfully rejested");
                };

            } catch (error) {
                console.log("Error => ", error);
                reject('Error initiating address');
            };
        } catch (error) {
            reject(error);
        };
    });
};

//.. user
export const checkout = (UID, body) => {
    return new Promise(async (resolve, reject) => {
        try {
            const userOutput = await auth.validatior({ UID: UID }, { UIDRequired: true });
            let method;

            if (body?.method == 'COD' || body?.method == 'online') method = body?.method;
            else throw 'Payment methord required';

            try {

                // if place order by existing address
                if (body?.type == 'id') {
                    // find address form db
                    try {
                        const address = await db.address.findOne({ UID: userOutput.UID });
                        let output = {};

                        // matching address
                        address?.address?.forEach(e => {
                            if (e._id == body.address) {
                                output = e;
                            };
                        });

                        if (address) {
                            try {
                                // place order
                                const data = await addTODB(userOutput.UID, output, method);
                                resolve(data);

                            } catch (error) {
                                reject(error);
                            };
                        } else {
                            reject("Plz select address");
                        };

                    } catch (error) {
                        console(error)
                        reject('Error fetching address form db');
                    };

                } else {
                    // place order by new address

                    // validate address
                    const addressOutput = await address.validator(UID, body.address);

                    // place order
                    const data = await addTODB(userOutput.UID, addressOutput, method, body?.address?.save ? 'YES' : 'NO');
                    resolve(data);
                };

            } catch (error) {
                reject(error);
            };
        } catch (error) {
            reject(error);
        };
    });
};
export const cancelOrderWithUID = (UID, orderID) => {
    return new Promise(async (resolve, reject) => {
        try {
            // valdiating user id ;
            const userOutput = await auth.validatior({ UID: UID }, { UIDRequired: true });

            try {

                // order data to find index and check for existence
                const existingData = await db.orders.find({ UID: userOutput.UID });

                if (existingData.length > 0) {

                    const index = existingData[0].orders.map(e => e._id == (orderID + "").trim()).indexOf(true);

                    if (index == -1) reject("Order not found");
                    else {

                        const updated = await db.orders.updateOne({ UID: userOutput.UID }, {
                            $set: {
                                [`orders.${index}.status`]: 'cancelled'
                            }
                        })

                        resolve("Order successfully cancelled");

                    };

                } else {
                    reject('Nothing to cancel');
                };

                //...
            } catch (error) {
                console.log('error => ', error);
                reject('Error cancelling order');
            };
            //...
        } catch (error) {
            reject(error);
        };
    });
};
export const cancelOrderProductWithUID = (UID, orderID, PID) => {
    return new Promise(async (resolve, reject) => {
        try {
            // valdiating user id ;
            const userOutput = await auth.validatior({ UID: UID }, { UIDRequired: true });
            const productOutput = await products.validatior({ PID: PID }, { PID: true }, 'updateproduct');
            try {

                // order data to find index and check for existence
                const existingData = await db.orders.find({ UID: userOutput.UID });

                if (existingData.length > 0) {

                    const indexOrder = existingData[0].orders.map(e => e._id == (orderID + "").trim()).indexOf(true);
                    const indexProduct = existingData[0].orders[indexOrder].products.map(e => e.PID == (productOutput.PID + "").trim()).indexOf(true);

                    if (indexProduct == -1) reject("Order not found");
                    else {

                        const updated = await db.orders.updateOne({ UID: userOutput.UID }, {
                            $set: {
                                [`orders.${indexOrder}.products.${indexProduct}.status`]: 'cancelled'
                            }
                        })

                        resolve("Order successfully cancelled");

                    };

                } else {
                    reject('Nothing to cancel');
                };

                //...
            } catch (error) {
                console.log('error => ', error);
                reject('Error cancelling order');
            };
            //...
        } catch (error) {
            reject(error);
        };
    });
};

//.. admin 
export const getAll = () => {
    return new Promise((resolve, reject) => {
        try {
            const data = db.orders.aggregate([
                {
                    $unwind: '$orders'
                },
                {
                    $lookup: {
                        localField: 'UID',
                        foreignField: 'UID',
                        from: 'users',
                        as: "user"
                    }
                },
                {
                    $sort: {
                        'orders.dateOFOrder': -1
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]);
            resolve(data);
        } catch (error) {
            reject(error);
        };
    });
};
export const getAllWithFromattedDate = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await getAll();
            const result = [];
            data.forEach((e, i, a) => {
                const output = {};
                const keys = Object.keys(e);
                keys.forEach((k, j, array) => {
                    output[keys[j]] = e[keys[j]];
                    if (keys[j] == 'orders') output[keys[j]].dateOFOrder = util.dataToReadable(e[keys[j]].dateOFOrder);
                    if (keys[j] == 'user') output[keys[j]][0].creationTime = util.dataToReadable(e[keys[j]][0].creationTime);
                    if (keys[j] == 'user') output[keys[j]][0].lastLogin = util.dataToReadable(e[keys[j]][0].lastLogin);
                    if (keys[j] == 'orders') output[keys[j]].products.forEach((ee, ii, aa) => {
                        output[keys[j]].products[ii].creationTime = util.dataToReadable(e[keys[j]].products[ii].creationTime);
                        output[keys[j]].products[ii].updated = util.dataToReadable(e[keys[j]].products[ii].updated);
                    });
                });
                result.push(output);
            });
            resolve(data);
        } catch (error) {
            reject(error);
        }
    });
};
export const cancelOrder = (orderID) => {
    return new Promise(async (resolve, reject) => {
        try {
            const existingData = await db.orders.find({ "orders._id": orderID });
            const index = existingData[0].orders.map(e => e._id == orderID).indexOf(true);

            const updated = await db.orders.updateOne({ "orders._id": orderID }, {
                $set: {
                    [`orders.${index}.status`]: 'cancelled'
                }
            });
            resolve("order successfully cancelled");
        } catch (error) {
            reject("Error cancelling order");
        };
    });
};
export const getByUID = (UID) => {
    return new Promise(async (resolve, reject) => {
        try {
            const userOutput = await auth.validatior({ UID: UID }, { UIDRequired: true });
            try {
                const orderData = await db.orders.aggregate([
                    {
                        $match: {
                            UID: userOutput.UID
                        }
                    },
                    {
                        $unwind: '$orders'
                    },
                    {
                        $sort: {
                            'orders.dateOFOrder': -1
                        }
                    }
                ]);
                resolve(orderData);
            } catch (error) {
                reject("Error fetching order data from db");
            };
        } catch (error) {
            reject(error);
        };
    });
};
export const getByUIDEach = (UID) => {
    return new Promise(async (resolve, reject) => {
        try {
            const userOutput = await auth.validatior({ UID: UID }, { UIDRequired: true });
            try {
                const orderData = await db.orders.aggregate([
                    {
                        $match: {
                            UID: userOutput.UID
                        }
                    },
                    {
                        $unwind: '$orders'
                    }
                    ,
                    {
                        $unwind: '$orders.products'
                    },
                    {
                        $sort: {
                            'orders.dateOFOrder': -1
                        }
                    }
                ]);
                resolve(orderData);
            } catch (error) {
                reject("Error fetching order data from db");
            };
        } catch (error) {
            reject(error);
        };
    });
};

const test = async () => {
    try {
        const data = await getByUIDEach('6pxw23gPVG0AlKh3IE6or782V');

        // data.map(e=>e['status']='pending');

        console.log('Result => ', data[0]);
    } catch (error) {
        console.log('TEST Err => ', error);
    };
};
// test();
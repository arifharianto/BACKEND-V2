var express = require('express');
var router = express.Router();
const stock_read_log = require('../models/stock_read_log');
const FileSystem = require("fs");
const { updateOne } = require('../models/stock_read_log');

router.use('/export-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.writeFile('./stock_read_log.json', JSON.stringify(list), (error) => {
      if (error) throw error;
  });

  console.log('stock_read_log.json exported!');
  res.json({statusCode: 1, message: 'stock_read_log.json exported!'})
});

router.use('/import-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.readFile('./stock_read_log.json', async (error, data) => {
      if (error) throw error;

      const list = JSON.parse(data);

      console.log(list);

      const deletedAll = await stock_read_log.deleteMany({});

      const insertedAll = await stock_read_log.insertMany(list);

      console.log('stock_read_log.json imported!');
  res.json({statusCode: 1, message: 'stock_read_log.json imported!'})
  });

  
})

router.use('/edit-repacking-data', async (req, res) => {
  let result = await stock_read_log.findOne(req.body);

  if(!result) throw error;

  let bulk = [];
  let index = 0;

  if(req.body.reject_qr_list){
    req.body.reject_qr_list.forEach(element => {
      //check if payload exist
      if(element.payload){
        
        //to change reject_qr_list payload status
        bulk.push(
          {
            updateOne : {
              "filter" :
                {
                  "payload": element.payload
                },
              "update" : {
                  $set: {
                    "status": 0,
                    "status_qc": 1
                  }
              }
            }
          }
        );
        
        //find in global payload qr_list
        index = result.qr_list.map(object => object.payload).indexOf(element.payload);

        //remove some array from global
        if (index > -1){
          result.qr_list.splice(index, 1);

          // bulk.push(
          //   {
          //     updateOne : {
          //       "filter" :
          //         {
          //           "payload": result.payload
          //         },
          //       "update" : {
          //           $pull: {
          //             "qr_list": {
          //               "payload": element.payload
          //             }
          //           }
          //       }
          //     }
          //   }
          // )
          //count forqty
          // result.qty = result.qr_list.length;
        }
      }
    });
  }

  if(req.body.new_qr_list){
    for (const new_qr of req.body.new_qr_list) {
      if(new_qr.payload){
        //find in global payload qr_list
        index = result.qr_list.map(object => object.payload).indexOf(new_qr.payload);

        // if elemnt not found and payload not same with global payload
        if (index < 0 && new_qr.payload != result.payload){

          //find detail new_qr_list
          let elementOne = await stock_read_log.findOne({ "payload": new_qr.payload });

          //insert into qr_list payload
          // bulk.push(
          //   {
          //     updateOne : {
          //       "filter" :
          //         {
          //           "payload": result.payload
          //         },
          //       "update" : {
          //           $push: {
          //             "qr_list": elementOne
          //           }
          //       }
          //     }
          //   }
          // )
          
          //store details to qr_list
          result.qr_list.push(elementOne)
          
          //check if new_qr_list payload on another payload
          let elementAnotherPayload = await stock_read_log.findOne(
            {"qr_list.payload": new_qr.payload}
          );

          //if element exist on another payload data qr_list
          //we deleted and updated qty on that data
          if(elementAnotherPayload){
            index = elementAnotherPayload.qr_list
            .map(object => object.payload)
            .indexOf(new_qr.payload);

            //remove some qr_list by index
            elementAnotherPayload.qr_list.splice(index, 1);
            
            bulk.push(
              {
                updateOne : {
                  "filter" :
                    {
                      "payload": elementAnotherPayload.payload
                    },
                  "update" : {
                      $pull: {
                        "qr_list": {
                          "payload": new_qr.payload
                        }
                      }
                  }
                }
              }
            )

            //for update qty
            bulk.push(
              {
                updateOne : {
                  "filter" :
                    {
                      "payload": elementAnotherPayload.payload
                    },
                  "update" : {
                      $set: {
                        "qty": elementAnotherPayload.qr_list.length
                      }
                  }
                }
              }
            )
          }
        }

      }
    }
  }

  //for update global payload
  bulk.push(
    {
      updateOne : {
        "filter" :
          {
            "payload": result.payload
          },
        "update" : {
            $set: {
              "qty": result.qr_list.length,
              "qr_list": result.qr_list
            }
        }
      }
    }
  )
  
  //bulkWrite
  let queries = await stock_read_log.bulkWrite(bulk);
  console.log(queries)
  res.json({statusCode: 1, result})
})

router.use('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

module.exports = {
    name: 'memes',
    alias: ['phd', 'xbox', 'cwinner', 'eury', 'nefiah', 'abysm', 'drunkdevil', 'shiba'],
    role: 'almostrl',
    async execute(message, args, bot) {
        switch (message.content.split(/ +/)[0].replace(/[^a-z]/gi, '').toLowerCase()) {
            case 'phd':
                message.channel.send({ files: ['https://cdn.discordapp.com/attachments/488881485366165515/733195330287304734/unknown.png'] })
                break;
            case 'xbox':
                message.channel.send(`<@!222042597877612546> xbox turn off`)
                break;
            case 'cwinner':
                message.channel.send({ files: [cwinner[~~(cwinner.length * Math.random())]] })
                break;
            case 'eury':
                message.channel.send({ files: [eury[~~(eury.length * Math.random())]] })
                break;
            case 'nefiah':
                let ghost = await message.channel.send(`Ghost pinged bitch <@!188081954728574976>`)
                await ghost.delete()
                message.delete()
                break;
            case 'abysm':
                message.channel.send({ files: ['https://cdn.discordapp.com/attachments/488881485366165515/733424455463993395/image0.png'] })
                break;
            case 'drunkdevil':
                message.channel.send({ files: ['https://cdn.discordapp.com/attachments/488881485366165515/733424511478923324/depositphotos_192384532-stock-photo-fun-giraffe-character-boat.png'] })
                break;
            case 'shiba':
                message.channel.send({ files: [shibas[~~(shibas.length * Math.random())]] })
        }
    }
}

const eury = ['https://cdn.discordapp.com/attachments/488881485366165515/685713463750033413/Eurydice.mp3',]
const cwinner = ['https://cdn.discordapp.com/attachments/488881485366165515/700880664517410956/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/700694536908701771/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/700694273686765578/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699665488699064451/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699665435045396570/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699647903693537661/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642623559729263/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642599996129300/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642582183182406/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699642566894682133/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699639459075063848/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699635653729714198/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699473358806319155/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699294560353910836/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699294529446084671/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/699294433413300244/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697225226576199720/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070674614681700/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070620919332964/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070590531731476/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070564317331526/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070536987246623/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070438924288010/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070379994447962/unknown.png', 'https://cdn.discordapp.com/attachments/488881485366165515/697070183633649724/unknown.png']
const shibas = ['https://cdn.discordapp.com/attachments/671146446036271109/674448427899158528/unknown.png', 'https://cdn.discordapp.com/attachments/671146446036271109/673368392626864160/images.jpeg', 'https://cdn.discordapp.com/attachments/611027069270228992/664660559999795230/unknown.png', 'https://cdn.discordapp.com/attachments/611027069270228992/664320846218657792/images.png', 'https://cdn.discordapp.com/attachments/691428737748697159/733529604920311838/ac1bbab79d33ad0528a357fb290bfca0.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730820081205903441/Screenshot_20200706-010840.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730819023180136448/ca1724d2e34e190bbba194f22f21c462.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730818957111722084/15c77aec26badf38a81db740867761a0.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730818893433667614/a6e20260308bbb3da301df16a5f3216a.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621673438445578/8d34b7e9249d34d0959f8e2dd0292582.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621673195307028/68d82f2046dda8b223b158c0ce78a931.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621672960426044/3a1e7405f1b36597ebafaccddfae9569.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621672595652608/b0ab570ccebe4a96af1a8585eb1e9103.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621671840415805/9900178ffafccdf981e340b33c08ed61.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621671639351366/ca1724d2e34e190bbba194f22f21c462.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621671136034857/b74341f7d4071962a67565483d757d5e.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621591645454436/e8b11bc9d9e1338a6040afea589ef311.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621591351984222/4b183ee1d6d290298b3d73ad5dbbf93d.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621591062315028/5102ee0c926701f08a294b8efd945f79.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621590685089893/78185fef07dad36ebc485851f41b36f8.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621590685089893/78185fef07dad36ebc485851f41b36f8.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621590307471430/8fd3ac1ed6a5c7677146f713a8152a42.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589976252457/11a1469990eb3c3cec151df8a9056b6f.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589737177108/aa41d635d26b4126d6ad7a4386dffb26.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589305032724/208ea63ab5289d7ed5796a48469659ab.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589057699942/4f49e728b8148aebf6664aa24d1753d8.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621588617035806/208b417a82546ce8a1c5e78de35a86e7.png', 'https://i.pinimg.com/236x/68/9d/f4/689df49a4c685d88ee31f199d870474f.jpg', 'https://i.pinimg.com/236x/f4/71/e4/f471e4a3c279938e56f3920cdecdf766.jpg', 'https://i.pinimg.com/236x/47/78/90/4778900ca649f678ae417507eca85c3d.jpg', 'https://i.pinimg.com/236x/a1/8a/d6/a18ad613f1416ea9c271552dafbea1d7.jpg', 'https://i.pinimg.com/236x/37/eb/63/37eb6396fecf5fb0d67ece60a890e949.jpg', 'https://i.pinimg.com/236x/20/c0/98/20c09842e1a86260f8a93d8e64f55091.jpg', 'https://i.pinimg.com/236x/40/b3/b6/40b3b687c0264066431017425c227b07.jpg', 'https://i.pinimg.com/236x/3a/50/dd/3a50dd86adc2dba5ab4f8a1cc73f8550.jpg', 'https://i.pinimg.com/236x/cc/3e/9d/cc3e9ddaeb92445d6a1c2cfa52d3f360.jpg', 'https://i.pinimg.com/236x/da/2e/c2/da2ec2f2fba74dd4c52c7013ec964090.jpg', 'https://i.pinimg.com/236x/16/57/e1/1657e154e8c70d7c84985754019cb9e5.jpg', 'https://i.pinimg.com/236x/f1/92/e7/f192e7a28de7505a26bdc28142eed8b5.jpg', 'https://i.pinimg.com/236x/ff/f9/2a/fff92a282da84dd77f9d24fc531b73c3.jpg', 'https://i.pinimg.com/236x/72/c8/7e/72c87e409667ac3bb4b112b06f88a350.jpg', 'https://i.pinimg.com/236x/d0/64/f8/d064f8db12669c1c366563f9bbbb95d9.jpg', 'https://i.pinimg.com/236x/96/3c/8e/963c8ef973cdef706b12026b15c52ea5.jpg', 'https://i.pinimg.com/236x/c6/86/c0/c686c099c88599e7d348ed34186c440b.jpg', 'https://i.pinimg.com/236x/e0/8f/08/e08f0873e9e223065d128770c613e32a.jpg', 'https://i.pinimg.com/236x/5c/e6/c5/5ce6c509ede95863e4512661733a339b.jpg', 'https://i.pinimg.com/236x/74/57/e7/7457e708bccbd691f13feedebfd402b6.jpg', 'https://i.pinimg.com/236x/e1/fa/b3/e1fab362603475d3baad3f2cb94dbcb3.jpg', 'https://i.pinimg.com/236x/f7/a0/b0/f7a0b05aedaa03f856907f525aa2f4c2.jpg', 'https://i.pinimg.com/236x/40/30/fb/4030fb4c4213c8c116c633a94e3bec70.jpg', 'https://i.pinimg.com/236x/2d/c1/6c/2dc16c63b63d874c5ba482c2a5c5d454.jpg', 'https://i.pinimg.com/236x/f7/a0/b0/f7a0b05aedaa03f856907f525aa2f4c2.jpg', 'https://i.pinimg.com/236x/39/fe/b5/39feb5799eae5eaf3ed5999431187136.jpg', 'https://i.pinimg.com/236x/62/1d/e4/621de4b7f67f92a1ecc23ac4939aa285.jpg', 'https://i.pinimg.com/236x/50/65/14/5065140b827db7692c636f8918646b47.jpg', 'https://i.pinimg.com/236x/5c/04/c1/5c04c138b9055de65f013da1757029c9.jpg', 'https://i.pinimg.com/236x/d8/48/cf/d848cfa3ebeac2bb20f26d98839764f9.jpg', 'https://i.pinimg.com/236x/c6/46/c7/c646c72461249027a913e4b2eb90f924.jpg', 'https://i.pinimg.com/236x/d5/fa/cd/d5facd766a06a9cbd45fc6ac33d4af1f.jpg', 'https://i.pinimg.com/236x/05/98/b1/0598b1263f9b6bf2a2b3d7f7711e0833.jpg', 'https://i.pinimg.com/236x/9e/0d/80/9e0d8039168dd4d9556158ab31a727aa.jpg', 'https://i.pinimg.com/236x/a4/8c/1f/a48c1fca4a416e5b4e744910ebea5740.jpg', 'https://i.pinimg.com/236x/a7/25/3f/a7253f6e730a12d12b52bda8d5f215d5.jpg', 'https://i.pinimg.com/236x/48/b6/45/48b64509e8cb085ba4ca608ebba92653.jpg', 'https://i.pinimg.com/236x/07/39/d0/0739d067d4289934832b381451ebc414.jpg', 'https://i.pinimg.com/236x/8b/9b/2b/8b9b2bc31cb415863fbe8b48c2a76d7d.jpg', 'https://i.pinimg.com/236x/01/79/29/017929c36dfe330fc580a448355aba13.jpg', 'https://i.pinimg.com/236x/8c/1b/7e/8c1b7eab13a8744b1a08637da364b7ba.jpg', 'https://i.pinimg.com/236x/e9/90/80/e9908016cf5743dfb75ebb538c8ef72f.jpg', 'https://i.pinimg.com/236x/51/b9/ff/51b9ffd73e567299b7dc29edc78f232b.jpg', 'https://i.pinimg.com/236x/35/a9/5b/35a95b19977d2cceea06394c981e6d60.jpg', 'https://i.pinimg.com/236x/5f/22/45/5f2245b75f2664711c3235768938dd2c.jpg', 'https://i.pinimg.com/236x/7d/62/b9/7d62b9b9c085ce6343d8ce4376cf5ee1.jpg', 'https://i.pinimg.com/236x/fe/b8/2f/feb82f809ae1f1270793a07e6be54957.jpg', 'https://i.pinimg.com/236x/18/96/79/189679cdbdfad185510bfa1ec0b508fd.jpg', 'https://i.pinimg.com/236x/99/41/fa/9941fa81f469d87aa21d4a49b6c38ddd.jpg', 'https://i.pinimg.com/236x/0d/97/55/0d9755380d70231dbd635217e703611e.jpg', 'https://i.pinimg.com/236x/7a/a7/73/7aa7737df4008c79e7ccf5cb8f1bbfaa.jpg', 'https://i.pinimg.com/236x/8d/72/f1/8d72f1a8127bc2587b6b43368dbd20e3.jpg', 'https://i.pinimg.com/236x/44/48/e7/4448e7efc90286a8dff112211dea9750.jpg', 'https://i.pinimg.com/236x/b8/52/27/b8522771a6c0c469fd2dbbe5609fc158.jpg', 'https://i.pinimg.com/236x/35/f0/38/35f038ebf90ab84223041e9442105878.jpg', 'https://cdn.discordapp.com/attachments/671146446036271109/674448427899158528/unknown.png', 'https://cdn.discordapp.com/attachments/671146446036271109/673368392626864160/images.jpeg', 'https://cdn.discordapp.com/attachments/611027069270228992/664660559999795230/unknown.png', 'https://cdn.discordapp.com/attachments/611027069270228992/664320846218657792/images.png', 'https://cdn.discordapp.com/attachments/691428737748697159/733529604920311838/ac1bbab79d33ad0528a357fb290bfca0.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730820081205903441/Screenshot_20200706-010840.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730819023180136448/ca1724d2e34e190bbba194f22f21c462.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730818957111722084/15c77aec26badf38a81db740867761a0.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730818893433667614/a6e20260308bbb3da301df16a5f3216a.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621673438445578/8d34b7e9249d34d0959f8e2dd0292582.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621673195307028/68d82f2046dda8b223b158c0ce78a931.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621672960426044/3a1e7405f1b36597ebafaccddfae9569.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621672595652608/b0ab570ccebe4a96af1a8585eb1e9103.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621671840415805/9900178ffafccdf981e340b33c08ed61.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621671639351366/ca1724d2e34e190bbba194f22f21c462.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621671136034857/b74341f7d4071962a67565483d757d5e.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621591645454436/e8b11bc9d9e1338a6040afea589ef311.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621591351984222/4b183ee1d6d290298b3d73ad5dbbf93d.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621591062315028/5102ee0c926701f08a294b8efd945f79.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621590685089893/78185fef07dad36ebc485851f41b36f8.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621590685089893/78185fef07dad36ebc485851f41b36f8.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621590307471430/8fd3ac1ed6a5c7677146f713a8152a42.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589976252457/11a1469990eb3c3cec151df8a9056b6f.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589737177108/aa41d635d26b4126d6ad7a4386dffb26.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589305032724/208ea63ab5289d7ed5796a48469659ab.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621589057699942/4f49e728b8148aebf6664aa24d1753d8.png', 'https://cdn.discordapp.com/attachments/691428737748697159/730621588617035806/208b417a82546ce8a1c5e78de35a86e7.png', 'https://i.pinimg.com/236x/68/9d/f4/689df49a4c685d88ee31f199d870474f.jpg', 'https://i.pinimg.com/236x/f4/71/e4/f471e4a3c279938e56f3920cdecdf766.jpg', 'https://i.pinimg.com/236x/47/78/90/4778900ca649f678ae417507eca85c3d.jpg', 'https://i.pinimg.com/236x/a1/8a/d6/a18ad613f1416ea9c271552dafbea1d7.jpg', 'https://i.pinimg.com/236x/37/eb/63/37eb6396fecf5fb0d67ece60a890e949.jpg', 'https://i.pinimg.com/236x/20/c0/98/20c09842e1a86260f8a93d8e64f55091.jpg', 'https://i.pinimg.com/236x/40/b3/b6/40b3b687c0264066431017425c227b07.jpg', 'https://i.pinimg.com/236x/3a/50/dd/3a50dd86adc2dba5ab4f8a1cc73f8550.jpg', 'https://i.pinimg.com/236x/cc/3e/9d/cc3e9ddaeb92445d6a1c2cfa52d3f360.jpg', 'https://i.pinimg.com/236x/da/2e/c2/da2ec2f2fba74dd4c52c7013ec964090.jpg', 'https://i.pinimg.com/236x/16/57/e1/1657e154e8c70d7c84985754019cb9e5.jpg', 'https://i.pinimg.com/236x/f1/92/e7/f192e7a28de7505a26bdc28142eed8b5.jpg', 'https://i.pinimg.com/236x/ff/f9/2a/fff92a282da84dd77f9d24fc531b73c3.jpg', 'https://i.pinimg.com/236x/72/c8/7e/72c87e409667ac3bb4b112b06f88a350.jpg', 'https://i.pinimg.com/236x/d0/64/f8/d064f8db12669c1c366563f9bbbb95d9.jpg', 'https://i.pinimg.com/236x/96/3c/8e/963c8ef973cdef706b12026b15c52ea5.jpg', 'https://i.pinimg.com/236x/c6/86/c0/c686c099c88599e7d348ed34186c440b.jpg', 'https://i.pinimg.com/236x/e0/8f/08/e08f0873e9e223065d128770c613e32a.jpg', 'https://i.pinimg.com/236x/5c/e6/c5/5ce6c509ede95863e4512661733a339b.jpg', 'https://i.pinimg.com/236x/74/57/e7/7457e708bccbd691f13feedebfd402b6.jpg', 'https://i.pinimg.com/236x/e1/fa/b3/e1fab362603475d3baad3f2cb94dbcb3.jpg', 'https://i.pinimg.com/236x/f7/a0/b0/f7a0b05aedaa03f856907f525aa2f4c2.jpg', 'https://i.pinimg.com/236x/40/30/fb/4030fb4c4213c8c116c633a94e3bec70.jpg', 'https://i.pinimg.com/236x/2d/c1/6c/2dc16c63b63d874c5ba482c2a5c5d454.jpg', 'https://i.pinimg.com/236x/f7/a0/b0/f7a0b05aedaa03f856907f525aa2f4c2.jpg', 'https://i.pinimg.com/236x/39/fe/b5/39feb5799eae5eaf3ed5999431187136.jpg', 'https://i.pinimg.com/236x/62/1d/e4/621de4b7f67f92a1ecc23ac4939aa285.jpg', 'https://i.pinimg.com/236x/50/65/14/5065140b827db7692c636f8918646b47.jpg', 'https://i.pinimg.com/236x/5c/04/c1/5c04c138b9055de65f013da1757029c9.jpg', 'https://i.pinimg.com/236x/d8/48/cf/d848cfa3ebeac2bb20f26d98839764f9.jpg', 'https://i.pinimg.com/236x/c6/46/c7/c646c72461249027a913e4b2eb90f924.jpg', 'https://i.pinimg.com/236x/d5/fa/cd/d5facd766a06a9cbd45fc6ac33d4af1f.jpg', 'https://i.pinimg.com/236x/05/98/b1/0598b1263f9b6bf2a2b3d7f7711e0833.jpg', 'https://i.pinimg.com/236x/9e/0d/80/9e0d8039168dd4d9556158ab31a727aa.jpg', 'https://i.pinimg.com/236x/a4/8c/1f/a48c1fca4a416e5b4e744910ebea5740.jpg', 'https://i.pinimg.com/236x/a7/25/3f/a7253f6e730a12d12b52bda8d5f215d5.jpg', 'https://i.pinimg.com/236x/48/b6/45/48b64509e8cb085ba4ca608ebba92653.jpg', 'https://i.pinimg.com/236x/07/39/d0/0739d067d4289934832b381451ebc414.jpg', 'https://i.pinimg.com/236x/8b/9b/2b/8b9b2bc31cb415863fbe8b48c2a76d7d.jpg', 'https://i.pinimg.com/236x/01/79/29/017929c36dfe330fc580a448355aba13.jpg', 'https://i.pinimg.com/236x/8c/1b/7e/8c1b7eab13a8744b1a08637da364b7ba.jpg', 'https://i.pinimg.com/236x/e9/90/80/e9908016cf5743dfb75ebb538c8ef72f.jpg', 'https://i.pinimg.com/236x/51/b9/ff/51b9ffd73e567299b7dc29edc78f232b.jpg', 'https://i.pinimg.com/236x/35/a9/5b/35a95b19977d2cceea06394c981e6d60.jpg', 'https://i.pinimg.com/236x/5f/22/45/5f2245b75f2664711c3235768938dd2c.jpg', 'https://i.pinimg.com/236x/7d/62/b9/7d62b9b9c085ce6343d8ce4376cf5ee1.jpg', 'https://i.pinimg.com/236x/fe/b8/2f/feb82f809ae1f1270793a07e6be54957.jpg', 'https://i.pinimg.com/236x/18/96/79/189679cdbdfad185510bfa1ec0b508fd.jpg', 'https://i.pinimg.com/236x/99/41/fa/9941fa81f469d87aa21d4a49b6c38ddd.jpg', 'https://i.pinimg.com/236x/0d/97/55/0d9755380d70231dbd635217e703611e.jpg', 'https://i.pinimg.com/236x/7a/a7/73/7aa7737df4008c79e7ccf5cb8f1bbfaa.jpg', 'https://i.pinimg.com/236x/8d/72/f1/8d72f1a8127bc2587b6b43368dbd20e3.jpg', 'https://i.pinimg.com/236x/44/48/e7/4448e7efc90286a8dff112211dea9750.jpg', 'https://i.pinimg.com/236x/b8/52/27/b8522771a6c0c469fd2dbbe5609fc158.jpg', 'https://i.pinimg.com/236x/35/f0/38/35f038ebf90ab84223041e9442105878.jpg', 'https://cdn.discordapp.com/attachments/488881485366165515/733905422334820402/image0.jpg',
    'https://cdn.discordapp.com/attachments/488881485366165515/733905673083027496/image0.jpg', 'https://i.pinimg.com/236x/65/dd/f7/65ddf763b5ebaf5711123cf2d3a3a49a.jpg', 'https://i.pinimg.com/236x/05/32/28/053228d74df4ab41a9ddc9b48925672d.jpg', 'https://i.pinimg.com/236x/1a/11/3f/1a113f2848fc1263d673edef38b8a90c.jpg', 'https://i.pinimg.com/236x/7c/d2/49/7cd2490e742fac44cc492f7589e38e10.jpg', 'https://i.pinimg.com/236x/e6/f8/ea/e6f8ea244647445a663340446360500a.jpg', 'https://i.pinimg.com/236x/2a/ed/47/2aed47ce66efb195e1241d56f7a43abe.jpg', 'https://i.pinimg.com/236x/c5/67/73/c56773dcfc53442c16eae8af38fbf164.jpg', 'https://i.pinimg.com/236x/d5/fa/cd/d5facd766a06a9cbd45fc6ac33d4af1f.jpg', 'https://i.pinimg.com/236x/8d/72/f1/8d72f1a8127bc2587b6b43368dbd20e3.jpg', 'https://i.pinimg.com/236x/62/2a/26/622a266d801e96bbe218e3ed04fd8ce2.jpg', 'https://i.pinimg.com/236x/ba/00/e3/ba00e3bb3fca6261c3418ac1205a584d.jpg', 'https://i.pinimg.com/236x/91/98/ff/9198ffac51e55d9b266aa50baf50ec8f.jpg', 'https://i.pinimg.com/236x/d1/55/cb/d155cb656cacd6e1026033d3e89b6933.jpg', 'https://i.pinimg.com/236x/d8/48/cf/d848cfa3ebeac2bb20f26d98839764f9.jpg', 'https://i.pinimg.com/236x/1c/97/14/1c9714eed06673f633930d3346bc3744.jpg', 'https://i.pinimg.com/236x/a5/7b/fe/a57bfe20978a2adb7e7f275f85b50487.jpg', 'https://i.pinimg.com/236x/55/3e/08/553e08e27a95a20aa48eb6d355a63c81.jpg', 'https://i.pinimg.com/236x/a8/e9/22/a8e922315aaecd55a6effc7e3864d98d.jpg', 'https://i.pinimg.com/236x/d1/0b/3b/d10b3ba9fb5b444d4cb0b58e049fbfda.jpg', 'https://i.pinimg.com/236x/28/7f/5c/287f5cb080a82bcece087043e15d897d.jpg', 'https://i.pinimg.com/236x/83/b1/ce/83b1ce6ee7a2c76215a4eede5ef0dbb6.jpg', 'https://i.pinimg.com/236x/9e/d0/b5/9ed0b5ffed1b0f2cc6712a4799e55591.jpg', 'https://i.pinimg.com/236x/5d/f5/8b/5df58bbd4755594db054c635af04dc03.jpg', 'https://i.pinimg.com/236x/01/6d/4c/016d4c0ea01f3a586b955fc4d8dd2fdd.jpg', 'https://i.pinimg.com/236x/15/f3/21/15f32183f697ffb0290d8817b8025bf3.jpg', 'https://i.pinimg.com/236x/03/2c/b1/032cb19e53f5c20c7b095d6b56c31d95.jpg', 'https://i.pinimg.com/236x/2a/80/52/2a805250988c628367fb0a61ab065d8f.jpg', 'https://i.pinimg.com/236x/64/d5/e0/64d5e00cf4121a5afc190e30f5a6956f.jpg', 'https://i.pinimg.com/236x/bf/44/53/bf4453209be86284d5a64d548d679a36.jpg', 'https://i.pinimg.com/236x/9e/ce/e2/9ecee2b482aeb7986bb5b1e81c4fefdb.jpg', 'https://i.pinimg.com/236x/94/2b/82/942b82e0b468824ffc0ef3c714436660.jpg', 'https://i.pinimg.com/236x/5f/ec/96/5fec96867b25cec101255c98de719507.jpg', 'https://i.pinimg.com/236x/3b/18/cd/3b18cdb9c3dbab83b25da0e0c03d0614.jpg', 'https://i.pinimg.com/236x/f7/b4/9a/f7b49af8882a7a258c88891d7913165e.jpg', 'https://i.pinimg.com/236x/2d/7f/b2/2d7fb2f3cbf352b9333812b4b449645a.jpg', 'https://i.pinimg.com/236x/6f/c2/25/6fc225ae115f656347028fd82281af53.jpg', 'https://i.pinimg.com/236x/74/41/45/7441451961a9863ba612b42cdfd6be98.jpg', 'https://i.pinimg.com/236x/1b/83/5c/1b835c249864a77e1f2f3296fba081f8.jpg', 'https://i.pinimg.com/236x/33/43/2d/33432d65bbc3e4e2a25b959c3ff7cc51.jpg', 'https://i.pinimg.com/236x/9a/ad/b5/9aadb5e09e0eba298d210463e139b4b0.jpg', 'https://i.pinimg.com/236x/8e/dd/ca/8eddcad3fee222fe749ccc47b959ba37.jpg', 'https://i.pinimg.com/236x/8a/9f/ac/8a9fac77a3eea8677c178540f28d226b.jpg', 'https://i.pinimg.com/236x/36/ab/39/36ab3909c35258907fe8d849923a997f.jpg', 'https://i.pinimg.com/236x/04/00/df/0400df9aa7006fb64d672fa515d66c1d.jpg', 'https://i.pinimg.com/236x/e7/77/43/e77743d8185993bbab61dbdbd95a3924.jpg', 'https://i.pinimg.com/236x/2d/ae/3d/2dae3d98052b5ebff34d85c40aa960c8.jpg', 'https://i.pinimg.com/236x/df/00/c5/df00c500c13d7814dd9018b8f7590b93.jpg', 'https://i.pinimg.com/236x/f2/24/50/f22450acdce0f9e3792f0223fb0f9165.jpg', 'https://i.pinimg.com/236x/fb/d1/da/fbd1da9e04039419caf8292b10af8315.jpg', 'https://i.pinimg.com/236x/ba/8f/02/ba8f02b1af02240813261565a4ca3cbe.jpg', 'https://i.pinimg.com/236x/a1/a8/3e/a1a83ee1f4389783fc4ba1f553548b72.jpg', 'https://i.pinimg.com/236x/ea/37/f6/ea37f68e6b20eec15ee67c04c264498f.jpg', 'https://i.pinimg.com/236x/29/96/85/299685a3b7b0c7943bb4db194628b570.jpg', 'https://i.pinimg.com/236x/4f/85/da/4f85dade01b98f1acec8eca0e8efe4bd.jpg', 'https://i.pinimg.com/236x/bc/f0/ac/bcf0acbc50af84531ddcb4c61845e962.jpg', 'https://i.pinimg.com/236x/27/90/5d/27905dcfc7c96a03e308a5a923b7871c.jpg', 'https://i.pinimg.com/236x/62/58/d9/6258d9a60eccfa95e2ce6047a95c99e6.jpg', 'https://i.pinimg.com/236x/a5/22/6e/a5226e9b76ccbb38e92a1b0efca247d7.jpg', 'https://i.pinimg.com/236x/54/ca/86/54ca86f1a43458422dbe5b31021d433e.jpg', 'https://i.pinimg.com/236x/79/a1/c0/79a1c063adc9cf0e3db94d4923ada672.jpg', 'https://i.pinimg.com/236x/b6/50/8c/b6508cdd232d84b9f8b3954377ab2267.jpg', 'https://i.pinimg.com/236x/fb/91/ac/fb91ac905556224bfc29080ea49f7a2b.jpg', 'https://i.pinimg.com/236x/10/23/5c/10235c4b01fbba2e95507ba3be0d0e3f.jpg', 'https://i.pinimg.com/236x/a2/a9/9f/a2a99ff54c1991ac0d43ed30f6c6e28a.jpg', 'https://i.pinimg.com/236x/5c/60/8a/5c608aedae35bf21497ca27aba9c5885.jpg', 'https://i.pinimg.com/236x/5c/60/8a/5c608aedae35bf21497ca27aba9c5885.jpg', 'https://i.pinimg.com/236x/ce/f9/23/cef923925431aca9e3c9c29ee87e5453.jpg', 'https://i.pinimg.com/236x/48/a3/6a/48a36a13626da84c93942a727b3590b6.jpg']
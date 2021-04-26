# roll20-give-xp
Simple script for roll20 API to automate XP distribution

## author: beniutek (Biskup Beniutek)
## license: MIT
The script checks all character sheets and saves the ones that have
{{current_player}} in the GM notes as characters controlled by players (so that later one only those characters progress with xp)

## COMMAND
!givexp [xp amount]
## SYNOPSIS
!givexp [--all --selected --total --portion] [xp amount]
## DESCRIPTION
xp amount must be numeric. It can be negative
--all makes it so that all available characters controlled by players receive xp
--selected makes it so that only character tokens selected on the map receive xp. This is the default. If there are no selected PCs then it takes all PCs available.
--total tells the script to treat the xp amount as a total amount of xp to be distributed between valid characters. This is the defaul
--portion tells the script that this xp value should be added to each character (so no distribution)
## EXAMPLES
assumption: There are total of 4 PCs.
!givexp 1000           -> takes all SELECTED PCs and gives 250 XP to each
!givexp --all 1000     -> takes all PCs and give 250 XP to each
!givexp --portion 1000 -> takes all SELECTED PCs and gives 100 XP to each
